const fsModule = require("fs");
const fs = fsModule.promises;
const path = require("path");
const os = require("os");
const { createHash } = require("crypto");

function expandHomePath(value) {
  let trimmed = value.trim();
  while (trimmed.length >= 2) {
    const quote = trimmed[0];
    if (
      (quote !== "'" && quote !== '"') ||
      trimmed[trimmed.length - 1] !== quote
    ) {
      break;
    }
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

function isSameOrInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function pathsOverlap(first, second) {
  return isSameOrInside(first, second) || isSameOrInside(second, first);
}

function parseExcludePaths(value) {
  return value
    .split(/\r?\n/)
    .map((entry) =>
      entry
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+|\/+$/g, ""),
    )
    .filter((entry) => {
      if (entry.split("/").includes("..")) {
        throw new Error(
          `Excluded paths must stay inside the vault: "${entry}".`,
        );
      }
      return entry.length > 0;
    });
}

function isExcluded(relativePath, exclusions) {
  const normalizedPath = relativePath.split(path.sep).join("/");
  return exclusions.some(
    (excluded) =>
      normalizedPath === excluded || normalizedPath.startsWith(`${excluded}/`),
  );
}

async function collectVaultEntries(
  sourcePath,
  exclusions,
  ignoreHiddenFolders,
) {
  const files = [];
  const directories = [];

  async function visit(absoluteDirectory, relativeDirectory) {
    const entries = await fs.readdir(absoluteDirectory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? path.join(relativeDirectory, entry.name)
        : entry.name;

      const isInsideObsidianConfig =
        relativePath === ".obsidian" ||
        relativePath.startsWith(`.obsidian${path.sep}`);
      if (
        ignoreHiddenFolders &&
        entry.isDirectory() &&
        entry.name.startsWith(".") &&
        !isInsideObsidianConfig
      ) {
        continue;
      }

      if (isExcluded(relativePath, exclusions)) {
        continue;
      }

      if (entry.isDirectory()) {
        directories.push(relativePath);
        await visit(path.join(absoluteDirectory, entry.name), relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await visit(sourcePath, "");
  return { files, directories };
}

async function statIfExists(absolutePath) {
  try {
    return await fs.lstat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function hashFile(absolutePath) {
  const hash = createHash("sha256");
  for await (const chunk of fsModule.createReadStream(absolutePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function removeObsoleteEntries(
  destinationPath,
  relativeDirectory,
  sourceFiles,
  sourceDirectories,
) {
  const absoluteDirectory = relativeDirectory
    ? path.join(destinationPath, relativeDirectory)
    : destinationPath;
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? path.join(relativeDirectory, entry.name)
      : entry.name;
    const absolutePath = path.join(destinationPath, relativePath);

    if (entry.isSymbolicLink()) {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      if (!sourceDirectories.has(relativePath)) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      } else {
        await removeObsoleteEntries(
          destinationPath,
          relativePath,
          sourceFiles,
          sourceDirectories,
        );
      }
    } else if (!sourceFiles.has(relativePath)) {
      await fs.rm(absolutePath, { recursive: true, force: true });
    }
  }
}

async function runVaultBackup({
  configuredSource,
  detectedSource,
  destinationSetting: rawDestinationSetting,
  excludePaths,
  ignoreHiddenFolders,
  onStatus = () => {},
  onProgress = () => {},
}) {
  const sourceSetting = configuredSource.trim()
    ? expandHomePath(configuredSource)
    : detectedSource;

  if (!sourceSetting || !path.isAbsolute(sourceSetting)) {
    throw new Error("Set an absolute vault source path in the plugin settings.");
  }

  const sourcePath = await fs.realpath(path.resolve(sourceSetting));
  const sourceStats = await fs.stat(sourcePath);
  if (!sourceStats.isDirectory()) {
    throw new Error("The vault source path must be a folder.");
  }

  const destinationSetting = expandHomePath(rawDestinationSetting);
  if (!destinationSetting || !path.isAbsolute(destinationSetting)) {
    throw new Error(
      "Set an absolute destination folder path in the plugin settings.",
    );
  }

  const destinationInput = path.resolve(destinationSetting);
  if (pathsOverlap(sourcePath, destinationInput)) {
    throw new Error(
      "The destination must not be inside or contain the source vault.",
    );
  }

  const exclusions = parseExcludePaths(excludePaths);
  onStatus("Scanning vault files...");
  const { files, directories } = await collectVaultEntries(
    sourcePath,
    exclusions,
    ignoreHiddenFolders,
  );

  await fs.mkdir(destinationInput, { recursive: true });
  const destinationPath = await fs.realpath(destinationInput);
  const targetPath = path.join(
    destinationPath,
    `[BACKUP] ${path.basename(sourcePath)}`,
  );

  if (pathsOverlap(sourcePath, targetPath)) {
    throw new Error(
      "The destination vault folder must not overlap the source vault.",
    );
  }

  const sourceFiles = new Set(files);
  const sourceDirectories = new Set(directories);
  const targetStats = await statIfExists(targetPath);
  if (
    targetStats &&
    (!targetStats.isDirectory() || targetStats.isSymbolicLink())
  ) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
  await fs.mkdir(targetPath, { recursive: true });

  await removeObsoleteEntries(
    targetPath,
    "",
    sourceFiles,
    sourceDirectories,
  );

  for (const relativeDirectory of directories) {
    await fs.mkdir(path.join(targetPath, relativeDirectory), {
      recursive: true,
    });
  }

  let copiedCount = 0;
  onProgress(0, files.length, copiedCount);
  for (let index = 0; index < files.length; index += 1) {
    const relativeFile = files[index];
    const sourceFile = path.join(sourcePath, relativeFile);
    const destinationFile = path.join(targetPath, relativeFile);
    const sourceFileStats = await fs.stat(sourceFile);
    const destinationStats = await statIfExists(destinationFile);
    const unchanged =
      destinationStats &&
      destinationStats.isFile() &&
      destinationStats.size === sourceFileStats.size &&
      destinationStats.mtimeMs === sourceFileStats.mtimeMs;
    const sameSize =
      destinationStats &&
      destinationStats.isFile() &&
      destinationStats.size === sourceFileStats.size;
    const unchangedByContent =
      !unchanged &&
      sameSize &&
      (await hashFile(sourceFile)) === (await hashFile(destinationFile));

    if (unchanged || unchangedByContent) {
      if (destinationStats.mtimeMs !== sourceFileStats.mtimeMs) {
        await fs.utimes(
          destinationFile,
          sourceFileStats.atimeMs / 1000,
          sourceFileStats.mtimeMs / 1000,
        );
      }
    } else {
      if (destinationStats) {
        await fs.rm(destinationFile, { recursive: true, force: true });
      }
      await fs.copyFile(sourceFile, destinationFile);
      await fs.utimes(
        destinationFile,
        sourceFileStats.atimeMs / 1000,
        sourceFileStats.mtimeMs / 1000,
      );
      copiedCount += 1;
    }

    onProgress(index + 1, files.length, copiedCount);
    if ((index + 1) % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    targetPath,
    fileCount: files.length,
    copiedCount,
  };
}

module.exports = {
  collectVaultEntries,
  parseExcludePaths,
  runVaultBackup,
};
