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
  `themes/lib/`. Switch with `~/.config/ags/scripts/set-theme.sh`. Qt side
  is Kvantum - `.config/Kvantum/` (the actual theme packs, ~3M, small enough
  to just vendor directly unlike the GTK packs below) plus `qt6ct`.
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

- `packages.dnf.txt` - everything installable via `dnf` (run this first -
  `ags` and the picker won't build without their deps)
- `sources.lock` + `build.sh` - `ags` and `hyprland-preview-share-picker`
  aren't packaged. `build.sh` clones each one, checks out the commit pinned
  in `sources.lock`, and builds/installs it, so a fresh machine gets the
  exact versions this repo was built against instead of whatever's on
  `HEAD` that day.
- `packages.other.md` - what each of those two tools is, why it isn't just
  a dnf package, and how to fetch the GTK theme packs / Nerd Font that
  neither `dnf` nor `build.sh` cover

## KDE-adjacent packages without the KDE spin

The source machine runs Fedora's KDE Plasma spin, and this setup leans on a
few pieces of that - SDDM (login), KWallet (`exec-once = ksecretd` in
hyprland.conf), the `polkit-kde` auth-prompt agent, `plasma-integration`
(what makes `QT_QPA_PLATFORMTHEME,kde` actually theme Qt apps), and the
Akonadi/KOrganizer/Kontact PIM stack. None of that requires the actual
Plasma shell (`plasma-workspace`/`plasma-desktop`) - each is independently
installable, confirmed with `rpm -q --requires` against the source machine.
They're called out as their own section in `packages.dnf.txt` for exactly
that reason: installing straight onto Hyprland without the KDE spin still
needs them, just explicitly instead of for free as part of a spin's default
set. `akonadi-server-mysql` needs a running MariaDB - `mariadb-server` is
listed alongside it, but the service still needs enabling/starting and
Akonadi's first-run setup still has to happen once.

## Machine-specific: monitors

`hyprland.conf` sources `.config/hypr/monitors.conf`, which is **gitignored**
- monitor names, positions, and refresh rates are per-machine. `install.sh`
  generates one from `monitors.conf.example` on first run; edit it for the
  box you're on (`hyprctl monitors all` once Hyprland is running shows real
  output names).

## Wallpapers

`wallpapers/` holds only the specific files a tracked config actually
points at (each theme's `theme.conf` `wallpaper=` key, plus the boot-time
default in `hypr/scripts/set-wallpaper.sh`) - currently 3 files, a few MB.
`install.sh` restores them to `~/Pictures/Wallpapers/<Category>/...`,
matching the paths configs expect.

The full wallpaper library (~1.5G on the source machine) is **not** in this
repo - that's personal media, not config, and doesn't belong in git. When
you add a theme with a new wallpaper, run `scripts/collect-wallpapers.sh`
to pull that file in automatically and commit the result.

## Deliberately not in here

- `waybar`/`rofi`-adjacent bar configs that aren't actually launched
- The ~120M of downloaded third-party GTK theme packs in `~/.themes` -
  fetch the ones you need per `packages.other.md`
- The full `~/Pictures/Wallpapers` library - see Wallpapers above
- Browser profile / any personal data
