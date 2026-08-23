# dotfiles

Fedora + Hyprland setup, built from what's actually running on the source
machine (not a distro template).

## What this is

- **Shell / bar / notifications**: `.config/ags/` - a custom [AGS](https://github.com/Aylur/ags)
  (Astal) TypeScript config. `waybar`/`nwg-panel` are installed on the
  source machine but not launched - ags is the real bar.
- **App launcher**: `.config/rofi/` (bound as `$menu` in hyprland.conf)
- **Theming**: `.config/themes/` - a small custom theme-pack system
  (`dark-gray`, `cozy-house`) with its own recolor/derive scripts under
  `themes/lib/`. Switch with `~/.config/ags/scripts/set-theme.sh`.
- **Window switching**: `.config/hypr/scripts/alt-tab.sh` - cross-workspace
  Alt+Tab, since Hyprland's own cyclenext only cycles the current workspace.
- **Everything else Hyprland**: `.config/hypr/` - split into
  `hyprland.conf`, `keybinds.conf`, `styling.conf`, `windowrules.conf`,
  `UnityFix.conf`, plus `scripts/` and the screen-share picker config
  `xdph.conf` (uses `hyprland-preview-share-picker` for live thumbnails
  instead of the stock text-only picker).

## Install

```bash
./install.sh
```

Symlinks everything into `$HOME`, backing up any real files/dirs it would
overwrite into `~/.dotfiles-backup-<timestamp>`. It does **not** install
packages - do that first/after, see below.

## Packages

- `packages.dnf.txt` - everything installable via `dnf`
- `packages.other.md` - everything that isn't packaged and has to be built
  or fetched by hand: `ags` itself, `hyprland-preview-share-picker`, the
  third-party GTK theme packs, and the Nerd Font

## Machine-specific: monitors

`hyprland.conf` sources `.config/hypr/monitors.conf`, which is **gitignored**
- monitor names, positions, and refresh rates are per-machine. `install.sh`
  generates one from `monitors.conf.example` on first run; edit it for the
  box you're on (`hyprctl monitors all` once Hyprland is running shows real
  output names).

## Deliberately not in here

- `waybar`/`rofi`-adjacent bar configs that aren't actually launched
- The ~120M of downloaded third-party GTK theme packs in `~/.themes` -
  fetch the ones you need per `packages.other.md`
- Browser profile / any personal data
