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

for d in hypr ags themes rofi gtk-3.0 gtk-4.0 qt6ct fontconfig kitty; do
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

# Wallpaper referenced by hypr/scripts/set-wallpaper.sh ($HOME/Pictures/...)
mkdir -p "$HOME/Pictures/Wallpapers/Galaxy"
cp -n "$SRC/wallpapers/"* "$HOME/Pictures/Wallpapers/Galaxy/"

cat <<'EOF'

Linked. Still needed before this is fully usable:

  1. dnf install $(grep -v '^#' packages.dnf.txt)
  2. Everything in packages.other.md:
       - build/install ags (Go) + `npm install` in ~/.config/ags
       - build/install hyprland-preview-share-picker (Rust)
       - fetch the GTK theme packs .config/themes/*/theme.conf reference
       - install the Caskaydia Cove Nerd Font
  3. Re-check .config/hypr/monitors.conf against this machine's real outputs.
EOF
