const { Modal } = require("obsidian");

module.exports = class BackupProgressModal extends Modal {
  onOpen() {
    this.setTitle("Backing up vault");
    this.statusEl = this.contentEl.createEl("p", {
      text: "Preparing the vault backup...",
    });
    this.progressEl = this.contentEl.createEl("progress", {
      attr: { max: "100", value: "0" },
    });
    this.progressEl.style.width = "100%";
  }

  setStatus(message) {
    this.statusEl.setText(message);
  }

  setProgress(checked, total, copied) {
    const percent = total === 0 ? 100 : Math.floor((checked / total) * 100);
    this.progressEl.value = percent;
    this.setStatus(
      `Checked ${checked} of ${total} files (${percent}%). ${copied} copied, ${checked - copied} unchanged.`,
    );
  }

  setComplete(targetPath, fileCount, copiedCount) {
    this.progressEl.value = 100;
    this.setStatus(
      `Backup complete. ${copiedCount} of ${fileCount} files updated in ${targetPath}.`,
    );
  }

  setError(message) {
    this.setStatus(`Backup failed: ${message}`);
  }
};
