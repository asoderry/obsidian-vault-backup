const { Notice, Plugin } = require("obsidian");
const BackupProgressModal = require("./progress-modal");
const BackupVaultSettingTab = require("./settings-tab");
const { getAutoBackupIntervalMs, normalizeSettings } = require("./settings");
const { runVaultBackup } = require("./backup-service");

const AUTO_BACKUP_CHECK_INTERVAL_MS = 60 * 1000;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = class BackupVaultPlugin extends Plugin {
  async onload() {
    this.settings = normalizeSettings((await this.loadData()) || {});

    this.addCommand({
      id: "back-up-vault",
      name: "Back-up Vault",
      callback: () => this.backupVault(),
    });
    this.addSettingTab(new BackupVaultSettingTab(this.app, this));
    this.isBackingUp = false;

    if (this.settings.autoBackupEnabled) {
      if (this.settings.lastAutoBackupAt === 0) {
        this.settings.lastAutoBackupAt = Date.now();
        try {
          await this.saveData(this.settings);
        } catch (error) {
          new Notice(
            `Could not save automatic backup schedule: ${errorMessage(error)}`,
          );
        }
      }
      this.startAutoBackupScheduler();
    }
  }

  async updateSetting(key, value) {
    this.settings[key] = value;
    if (key === "autoBackupEnabled" && value) {
      this.settings.lastAutoBackupAt = Date.now();
    }

    try {
      await this.saveData(this.settings);
    } catch (error) {
      new Notice(`Could not save Vault Backup settings: ${errorMessage(error)}`);
    }

    if (key === "autoBackupEnabled") {
      if (value) {
        this.startAutoBackupScheduler();
      } else {
        this.stopAutoBackupScheduler();
      }
    }
  }

  startAutoBackupScheduler() {
    if (this.autoBackupTimer !== undefined) {
      return;
    }
    this.autoBackupTimer = this.registerInterval(
      window.setInterval(
        () => this.checkAutoBackup(),
        AUTO_BACKUP_CHECK_INTERVAL_MS,
      ),
    );
  }

  stopAutoBackupScheduler() {
    if (this.autoBackupTimer === undefined) {
      return;
    }
    window.clearInterval(this.autoBackupTimer);
    this.autoBackupTimer = undefined;
  }

  checkAutoBackup() {
    if (!this.settings.autoBackupEnabled || this.isBackingUp) {
      return;
    }

    const intervalMs = getAutoBackupIntervalMs(this.settings);
    if (Date.now() - this.settings.lastAutoBackupAt < intervalMs) {
      return;
    }

    void this.backupVault({ automatic: true });
  }

  async backupVault({ automatic = false } = {}) {
    if (this.isBackingUp) {
      new Notice(
        automatic
          ? "Automatic vault backup skipped because another backup is in progress."
          : "A vault backup is already in progress.",
      );
      return;
    }

    this.isBackingUp = true;
    if (automatic) {
      this.settings.lastAutoBackupAt = Date.now();
      new Notice("Automatic vault backup started.");
      try {
        await this.saveData(this.settings);
      } catch (error) {
        new Notice(
          `Could not save automatic backup schedule: ${errorMessage(error)}`,
        );
      }
    }

    const modal = automatic ? null : new BackupProgressModal(this.app);
    modal?.open();

    try {
      const adapter = this.app.vault.adapter;
      const result = await runVaultBackup({
        configuredSource: this.settings.sourcePath,
        detectedSource:
          typeof adapter.getBasePath === "function" ? adapter.getBasePath() : "",
        destinationSetting: this.settings.destinationPath,
        excludePaths: this.settings.excludePaths,
        ignoreHiddenFolders: this.settings.ignoreHiddenFolders,
        onStatus: (message) => modal?.setStatus(message),
        onProgress: (checked, total, copied) =>
          modal?.setProgress(checked, total, copied),
      });

      modal?.setComplete(
        result.targetPath,
        result.fileCount,
        result.copiedCount,
      );
      const unchangedCount = result.fileCount - result.copiedCount;
      const copiedLabel = result.copiedCount === 1 ? "file" : "files";
      const unchangedLabel = unchangedCount === 1 ? "file" : "files";
      new Notice(
        `${automatic ? "Automatic vault backup complete" : "Vault backup updated"} at ${result.targetPath}. ${result.copiedCount} ${copiedLabel} copied, ${unchangedCount} ${unchangedLabel} unchanged.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      modal?.setError(message);
      new Notice(
        automatic
          ? `Automatic vault backup failed: ${message}`
          : `Could not back up vault: ${message}`,
      );
    } finally {
      this.isBackingUp = false;
    }
  }
};
