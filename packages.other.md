# Not packaged - built from source via build.sh

`./build.sh` clones each project below into `.build/<name>/` (gitignored),
checks out the commit pinned in `sources.lock`, and builds/installs it. Run
it after `dnf install`-ing everything in `packages.dnf.txt` - both tools
need real build deps present first (ags in particular will fail without the
astal COPR packages and meson/ninja).

To move a pin forward: `cd .build/<name>`, check out whatever you want,
confirm it still works, then copy that commit hash into `sources.lock` and
commit.

## ags (Astal Shell CLI)

The actual desktop shell (`.config/ags/`) - bar, notifications, app icons.
[Aylur/ags](https://github.com/Aylur/ags) is a meson project: it builds a Go
CLI binary but links it (via `-ldflags`) against hardcoded paths to the
gtk4-layer-shell lib, the installed JS runtime dir, `gjs`, and `bash` - so
this is **not** a plain `go build`, meson has to drive it. `build.sh` runs:

```bash
npm install
meson setup build
sudo meson install -C build   # default prefix /usr/local, hence sudo
```

It also links against the Astal C libraries (`libastal-*`), which come from
the `starfall/astalRPM` COPR, not core Fedora repos - see the comment at the
top of `packages.dnf.txt`.

Launched via `exec-once = ags run` in hyprland.conf.

## hyprland-preview-share-picker

Screen-share picker with live window/monitor thumbnails, used instead of the
stock text-only `hyprland-share-picker` - see `.config/hypr/xdph.conf`.
`build.sh` runs `cargo install --path . --force`, which needs a Rust
toolchain (`rustc`/`cargo`) plus `gtk4-devel` and `gtk4-layer-shell-devel`
(in packages.dnf.txt). If the build complains about unstable features, it
wants nightly: `rustup toolchain install nightly`, then edit that one line
in `build.sh` to `cargo +nightly install ...`.

Installs to `~/.cargo/bin/hyprland-preview-share-picker`, which is what
`xdph.conf` in this repo points at.

## Hyprland (source patch)

`build.sh` pulls from [my fork](https://github.com/presto1241/Hyprland),
branch `tearing-fix`, not upstream hyprwm/Hyprland. The `hyprland` package
from the lionheartp/Hyprland COPR (see `packages.dnf.txt`) has a real bug:
a v0.56.1 regression that stops screen tearing from ever bootstrapping
(`view: do not render monitor for tearing if it's blocked (#15500)` created a
circular guard - see the source machine's memory of this if this repo ever
grows its own notes directory). The fork is that exact COPR build's commit
with that one PR reverted, nothing else. `build.sh` runs:

```bash
make release PREFIX=/usr
sudo cmake --install ./build   # overwrites the dnf package's files
sudo dnf versionlock add hyprland   # stops a routine update from reverting this
```

No 0.57 release existed as of the fork's commit - check upstream before
redoing this, it may already be fixed there.

## hyprbars (hyprbars-hover fork)

`build.sh` pulls from
[my hyprland-plugins fork](https://github.com/presto1241/hyprland-plugins),
branch `hyprbars-hover`, not upstream hyprwm/hyprland-plugins. Adds a
`hover_to_reveal` option upstream doesn't have (bar stays collapsed until the
mouse hovers the window's top edge), a fade in/out on that reveal, and a
configurable `icon_font` for button icons (was hardcoded to `"sans"`, which
doesn't have Nerd Font icon glyphs). See `.config/hypr/hyprland.conf`'s
`plugin { hyprbars { ... } }` block for the actual config.

Must run *after* Hyprland above is built and installed - `hyprpm`'s own
header/plugin-commit auto-matching only works against public upstream
commits, and this fork's commits (like Hyprland's) only exist on GitHub
under my account, not upstream, so `build.sh` points both steps at local
paths instead of letting hyprpm guess:

```bash
hyprpm update --hl-url .build/Hyprland --no-shallow
hyprpm add .build/hyprland-plugins <commit>
hyprpm enable hyprbars
```

If `hyprpm` ever complains about headers being outdated or a plugin failing
to build after this, that almost always means Hyprland's install above and
hyprpm's cached headers have drifted apart - rerun the `hyprpm update
--hl-url` line before assuming the plugin itself is broken.

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
