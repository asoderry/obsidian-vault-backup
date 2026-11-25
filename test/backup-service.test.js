const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { runVaultBackup } = require("../backup-service");

async function createFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function createTestVault(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vault-backup-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  return {
    source: path.join(root, "Vault"),
    destination: path.join(root, "destination"),
  };
}

test(
  "copies Obsidian config and regular hidden files, while skipping hidden folders and exclusions",
  async (t) => {
    const { source, destination } = await createTestVault(t);
    await createFile(
      path.join(source, ".obsidian", "plugins", "sample", "data.json"),
      '{"enabled":true}',
    );
    await createFile(path.join(source, ".cache", "large-cache.bin"), "cache");
    await createFile(path.join(source, ".env"), "local setting");
    await createFile(
      path.join(source, "Attachments", "temporary", "draft.png"),
      "temporary",
    );
    await createFile(path.join(source, "Notes", "welcome.md"), "Hello");

    const result = await runVaultBackup({
      configuredSource: source,
      detectedSource: "",
      destinationSetting: destination,
      excludePaths: "Attachments/temporary",
      ignoreHiddenFolders: true,
    });
    const target = path.join(
      await fs.realpath(destination),
      "[BACKUP] Vault",
    );

    assert.equal(result.targetPath, target);
    assert.equal(
      await fs.readFile(
        path.join(target, ".obsidian", "plugins", "sample", "data.json"),
        "utf8",
      ),
      '{"enabled":true}',
    );
    assert.equal(
      await fs.readFile(path.join(target, ".env"), "utf8"),
      "local setting",
    );
    assert.equal(
      await fs.readFile(path.join(target, "Notes", "welcome.md"), "utf8"),
      "Hello",
    );
    await assert.rejects(fs.access(path.join(target, ".cache")));
    await assert.rejects(
      fs.access(path.join(target, "Attachments", "temporary")),
    );
  },
);

test(
  "includes hidden folders when enabled and removes them when they become ignored",
  async (t) => {
    const { source, destination } = await createTestVault(t);
    await createFile(path.join(source, ".cache", "data.bin"), "cache");
    await createFile(path.join(source, "note.md"), "Note");

    const settings = {
      configuredSource: source,
      detectedSource: "",
      destinationSetting: destination,
      excludePaths: "",
    };

    await runVaultBackup({ ...settings, ignoreHiddenFolders: false });
    const target = path.join(
      await fs.realpath(destination),
      "[BACKUP] Vault",
    );
    assert.equal(
      await fs.readFile(path.join(target, ".cache", "data.bin"), "utf8"),
      "cache",
    );

    await runVaultBackup({ ...settings, ignoreHiddenFolders: true });
    await assert.rejects(fs.access(path.join(target, ".cache")));
  },
);
