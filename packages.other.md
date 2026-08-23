# Not packaged - build these by hand

## ags (Astal Shell CLI)

The actual desktop shell (`.config/ags/`) - bar, notifications, app icons.
`/usr/local/bin/ags` on the source machine is a Go binary, not an RPM. Build
it from [Aylur/ags](https://github.com/Aylur/ags) (needs `golang`, already in
packages.dnf.txt), install the resulting binary to somewhere on `$PATH`
(`/usr/local/bin` matches this repo's assumptions), then from
`.config/ags/` run `npm install` to pull in the `ags`/`gnim` TypeScript
bindings referenced by `package.json`.

Launched via `exec-once = ags run` in hyprland.conf.

## hyprland-preview-share-picker

Screen-share picker with live window/monitor thumbnails, used instead of the
stock text-only `hyprland-share-picker` - see `.config/hypr/xdph.conf`.

```bash
git clone --recursive https://github.com/WhySoBad/hyprland-preview-share-picker
cd hyprland-preview-share-picker
cargo build --release
cargo install --path .
```

Needs a Rust toolchain (`rustc`/`cargo`) plus `gtk4-devel` and
`gtk4-layer-shell-devel` (both in packages.dnf.txt). If the build complains
about unstable features, it wants nightly: `rustup toolchain install nightly`
and build with `cargo +nightly build --release` instead.

Installs to `~/.cargo/bin/hyprland-preview-share-picker`, which is what
`xdph.conf` in this repo points at.

## GTK theme packs (~/.themes)

`.config/themes/` (this repo's own recolor/theme-pack system) picks a base
GTK theme out of `~/.themes/`, `~/.local/share/themes/`, or
`/usr/share/themes/`. The actual theme packs (Orchis, Juno-ocean, Ant-Nebula,
etc. - ~118M on the source machine) are third-party downloads, not vendored
here. Grab whichever ones `.config/themes/*/theme.conf` reference from their
respective GitHub releases/AUR packages before running `set-theme.sh`.

## Fonts

Caskaydia Cove Nerd Font (Propo variant) - not always packaged for Fedora.
Grab it from the [Nerd Fonts releases](https://github.com/ryanoasis/nerd-fonts/releases)
and drop the `.ttf` files in `~/.local/share/fonts/`, then `fc-cache -f`.
