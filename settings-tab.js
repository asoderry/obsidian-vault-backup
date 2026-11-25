const { PluginSettingTab, Setting } = require("obsidian");

module.exports = class BackupVaultSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Backup" });

    new Setting(containerEl)
      .setName("Vault source path")
      .setDesc(
        "Leave blank to detect this vault's location automatically. Otherwise, enter an absolute path. Paths may start with ~ for your home folder.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Automatically detected")
          .setValue(this.plugin.settings.sourcePath)
          .onChange((value) => this.plugin.updateSetting("sourcePath", value)),
      );

    new Setting(containerEl)
      .setName("Backup destination folder")
      .setDesc(
        "Path to the folder on the other drive that will contain the backup. A folder named after this vault will be created inside it. Paths may start with ~ for your home folder.",
      )
      .addText((text) =>
        text
          .setPlaceholder("/Volumes/Backup")
          .setValue(this.plugin.settings.destinationPath)
          .onChange((value) =>
            this.plugin.updateSetting("destinationPath", value),
          ),
      );

    new Setting(containerEl)
      .setName("Excluded paths")
      .setDesc(
        "One vault-relative file or folder path per line. Excluding a folder also excludes everything inside it.",
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(".obsidian/workspace.json\nAttachments/temporary")
          .setValue(this.plugin.settings.excludePaths)
          .onChange((value) =>
            this.plugin.updateSetting("excludePaths", value),
          );
        text.inputEl.rows = 6;
        text.inputEl.style.width = "100%";
      });

    new Setting(containerEl)
      .setName("Ignore hidden folders")
      .setDesc(
        "Skip folders whose names start with a dot. The vault's .obsidian folder is always included. Excluded paths still apply.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ignoreHiddenFolders)
          .onChange((value) =>
            this.plugin.updateSetting("ignoreHiddenFolders", value),
          ),
      );

    new Setting(containerEl)
      .setName("Automatic backups")
      .setDesc(
        "Run backups automatically. The first backup runs after the selected interval.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoBackupEnabled)
          .onChange((value) =>
            this.plugin.updateSetting("autoBackupEnabled", value),
          ),
      );

    new Setting(containerEl)
      .setName("Automatic backup interval")
      .setDesc("Choose how often automatic backups run.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.step = "1";
        text
          .setValue(String(this.plugin.settings.autoBackupInterval))
          .onChange((value) => {
            const interval = Number(value);
            if (Number.isSafeInteger(interval) && interval >= 1) {
              this.plugin.updateSetting("autoBackupInterval", interval);
            }
          });
      })
      .addDropdown((dropdown) =>
        dropdown
          .addOption("hours", "Hours")
          .addOption("days", "Days")
          .addOption("weeks", "Weeks")
          .setValue(this.plugin.settings.autoBackupUnit)
          .onChange((value) =>
            this.plugin.updateSetting("autoBackupUnit", value),
          ),
      );

    new Setting(containerEl)
      .setName("Test automatic backup")
      .setDesc(
        "Run an automatic-style backup immediately. This copies to the configured destination and resets the next scheduled run.",
      )
      .addButton((button) =>
        button
          .setButtonText("Run test")
          .onClick(() => this.plugin.backupVault({ automatic: true })),
      );

    new Setting(containerEl)
      .setName("Back up vault")
      .setDesc(
        "Create or update the backup now. Unchanged files are left in place, and destination files or folders missing from the source are removed.",
      )
      .addButton((button) =>
        button
          .setButtonText("Back up now")
          .setCta()
          .onClick(() => this.plugin.backupVault()),
      );
  }
};
