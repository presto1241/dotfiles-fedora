#!/usr/bin/env bash
# Symlinks this repo's configs into $HOME. Existing real files/dirs at the
# destination are moved aside, not deleted.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HOME/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)"

link() {
    local rel="$1"
    local src="$SRC/$rel"
    local dst="$HOME/$rel"
    mkdir -p "$(dirname "$dst")"
    if [ -L "$dst" ]; then
        rm "$dst"
    elif [ -e "$dst" ]; then
        mkdir -p "$BACKUP/$(dirname "$rel")"
        mv "$dst" "$BACKUP/$rel"
        echo "backed up existing ~/$rel -> $BACKUP/$rel"
    fi
    ln -s "$src" "$dst"
    echo "linked ~/$rel"
}

link .bashrc

for d in hypr ags themes rofi gtk-3.0 gtk-4.0 qt6ct fontconfig kitty Kvantum; do
    link ".config/$d"
done

for f in gtkrc gtkrc-2.0 QtProject.conf mimeapps.list; do
    [ -e "$SRC/.config/$f" ] && link ".config/$f"
done

# Machine-local monitor layout - lives inside the repo checkout (since
# .config/hypr is symlinked wholesale above) but is gitignored.
if [ ! -e "$SRC/.config/hypr/monitors.conf" ]; then
    cp "$SRC/.config/hypr/monitors.conf.example" "$SRC/.config/hypr/monitors.conf"
    echo
    echo "Created .config/hypr/monitors.conf from the template."
    echo "Edit it for THIS machine's outputs before starting Hyprland - run"
    echo "'hyprctl monitors all' once you're in a session to see real names/modes."
fi

# Wallpapers referenced by theme.conf / set-wallpaper.sh - only the specific
# files configs point at (see scripts/collect-wallpapers.sh), restored to
# their original ~/Pictures/Wallpapers/<Category>/ subpath. The rest of your
# wallpaper library is out of scope for this repo - sync it however you sync
# large media.
rsync -a "$SRC/wallpapers/" "$HOME/Pictures/Wallpapers/"

# swww was renamed upstream to awww (it's what Arch ships), but the configs and
# scripts still call `swww` / `swww-daemon`. Where only awww is installed,
# shim the old names. /usr/local/bin rather than ~/.local/bin so it's on PATH
# for the Hyprland session too, which doesn't always inherit the user's PATH.
if command -v awww >/dev/null && ! command -v swww >/dev/null; then
    echo
    echo "awww found but no swww - linking the old names (needs sudo):"
    sudo ln -sf "$(command -v awww)" /usr/local/bin/swww
    sudo ln -sf "$(command -v awww-daemon)" /usr/local/bin/swww-daemon
    echo "linked /usr/local/bin/swww -> awww, swww-daemon -> awww-daemon"
fi

cat <<'EOF'

Linked. Still needed before this is fully usable:

  1. Install packages: Fedora: dnf install $(grep -v '^#' packages.dnf.txt)
     Arch: packages.pacman.txt, packages.aur.txt, packages.pacman.nvidia.txt
     (commands are at the top of each file)
  2. Everything in packages.other.md:
       - build/install ags (Go) + `npm install` in ~/.config/ags
       - build/install hyprland-preview-share-picker (Rust)
       - fetch the GTK theme packs .config/themes/*/theme.conf reference
       - install the Caskaydia Cove Nerd Font
  3. Re-check .config/hypr/monitors.conf against this machine's real outputs.
EOF
