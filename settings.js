const AUTO_BACKUP_UNIT_MS = {
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_SETTINGS = {
  sourcePath: "",
  destinationPath: "",
  excludePaths: "",
  ignoreHiddenFolders: true,
  autoBackupEnabled: false,
  autoBackupInterval: 1,
  autoBackupUnit: "days",
  lastAutoBackupAt: 0,
};

function normalizeSettings(savedSettings) {
  const saved =
    savedSettings && typeof savedSettings === "object" ? savedSettings : {};
  const settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
  };

  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof settings[key] !== typeof defaultValue) {
      settings[key] = defaultValue;
    }
  }

  if (
    !Number.isSafeInteger(settings.autoBackupInterval) ||
    settings.autoBackupInterval < 1
  ) {
    settings.autoBackupInterval = DEFAULT_SETTINGS.autoBackupInterval;
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      AUTO_BACKUP_UNIT_MS,
      settings.autoBackupUnit,
    )
  ) {
    settings.autoBackupUnit = DEFAULT_SETTINGS.autoBackupUnit;
  }

  if (
    !Number.isFinite(settings.lastAutoBackupAt) ||
    settings.lastAutoBackupAt < 0
  ) {
    settings.lastAutoBackupAt = DEFAULT_SETTINGS.lastAutoBackupAt;
  }

  return settings;
}

function getAutoBackupIntervalMs(settings) {
  return (
    settings.autoBackupInterval * AUTO_BACKUP_UNIT_MS[settings.autoBackupUnit]
  );
}

module.exports = {
  AUTO_BACKUP_UNIT_MS,
  DEFAULT_SETTINGS,
  getAutoBackupIntervalMs,
  normalizeSettings,
};
