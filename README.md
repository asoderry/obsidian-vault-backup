# Vault Backup

An Obsidian desktop plugin that creates an incremental copy of a vault in a
separate destination folder.

<b>NOTE: This is fully AI generated code!</b>

## Features

- Detects the current vault path or accepts a configured absolute path.
- Copies the vault into a folder named `[BACKUP] <vault name>`.
- Updates changed files and removes destination entries that no longer exist in
  the source.
- Supports vault-relative file and folder exclusions.
- Includes the vault's `.obsidian` settings, plugins, themes, and snippets.
- Optionally skips other dot-prefixed folders. Dot-prefixed regular files are
  still copied.
- Can run automatically on an hourly, daily, or weekly interval.
- Shows a progress dialog for manual runs and non-blocking notices for
  automatic runs.

## Install

Clone this repository into the vault's plugin directory:

```sh
git clone https://github.atcloud.io/Dante-Toole/obsidian-backup-vault.git \
  "<vault>/.obsidian/plugins/backup-vault"
```

Then enable **Vault Backup** in Obsidian under **Settings > Community plugins**.
The plugin is desktop-only because it uses Node.js filesystem APIs.

To update an existing clone, run `git pull` from the plugin directory.

## Configure

Open **Settings > Community plugins > Vault Backup**.

- Set the destination folder on the drive where backups should be stored. Paths
  may start with `~` for your home folder and may be wrapped in quotes if they
  contain spaces.
- Leave the source path blank to detect the current vault, or set an absolute
  path.
- Add one vault-relative path per line to **Excluded paths**.
- **Ignore hidden folders** is enabled by default. It skips dot-prefixed folders
  other than `.obsidian`, which is always included. Explicit exclusions still
  apply to `.obsidian`.
- **Automatic backups** are disabled by default. Enable them and choose a
  positive interval in hours, days, or weeks. The first run occurs after the
  selected interval.
- Use **Test automatic backup > Run test** to trigger the automatic notification
  flow immediately. It performs a real backup and resets the next scheduled run.

## Backup behavior

The destination folder is synchronized with the selected source entries. Files
and folders that are no longer included in the source are removed from the
destination on the next run. Choose a destination that is separate from the
source vault.

The plugin does not follow symbolic links. Excluded paths and hidden-folder
handling apply consistently to both manual and automatic backups.

## Local settings and privacy

Obsidian stores per-device settings in `data.json`, including configured paths
and exclusions. This file is ignored by Git and should not be committed. The
repository contains plugin code and documentation only, not vault notes or
attachments.

## Development

Rebuild Obsidian's single-file plugin entry point after changing source modules:

```sh
node build.js
```

Run the filesystem backup tests with Node.js:

```sh
node --test
```

The source is split by responsibility, and `main.js` is the generated file
Obsidian loads:

- `plugin-source.js`: plugin lifecycle, automatic scheduling, and notifications.
- `backup-service.js`: filesystem scanning, exclusions, and incremental copying.
- `settings-tab.js`: Obsidian settings UI.
- `progress-modal.js`: manual backup progress dialog.
- `settings.js`: defaults, validation, and interval units.
- `build.js`: creates the self-contained `main.js` bundle without dependencies.
