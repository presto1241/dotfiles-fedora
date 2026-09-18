#!/usr/bin/env bash
# Copies live configs from $HOME back into this repo checkout - the reverse
# of install.sh. Run this after tweaking something live (new theme, script
# edit, etc.) to pull it into git before committing.
#
# The repo side is versioned, so unlike install.sh this doesn't back
# anything up - `git status`/`git diff` after running is the review step.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sync() {
    local rel="$1"
    local live="$HOME/$rel"
    local repo="$SRC/$rel"
    if [ ! -e "$live" ]; then
        echo "skipping ~/$rel (doesn't exist)"
        return
    fi
    mkdir -p "$(dirname "$repo")"
    if [ -d "$live" ]; then
        rsync -a --delete \
            --exclude '__pycache__' --exclude '*.pyc' \
            --exclude 'node_modules' --exclude '@girs' \
            --exclude 'monitors.conf' \
            --exclude '*.bak' --exclude '*.disabled' --exclude '*.orig' \
            "$live/" "$repo/"
    else
        cp -a "$live" "$repo"
    fi
    echo "synced ~/$rel"
}

sync .bashrc

for d in hypr ags themes rofi gtk-3.0 gtk-4.0 qt6ct fontconfig kitty Kvantum; do
    sync ".config/$d"
done

for f in gtkrc gtkrc-2.0 QtProject.conf mimeapps.list; do
    [ -e "$HOME/.config/$f" ] && sync ".config/$f"
done

# themes/current is a live symlink to an absolute path; the repo tracks it
# as a relative one (see install.sh) so it stays portable across machines -
# the rsync above would otherwise copy the absolute target as-is.
if [ -L "$HOME/.config/themes/current" ]; then
    target="$(basename "$(readlink -f "$HOME/.config/themes/current")")"
    ln -sfn "$target" "$SRC/.config/themes/current"
    echo "synced ~/.config/themes/current -> $target"
fi

cat <<'EOF'

Synced. Repo is versioned, so nothing was backed up - review before
committing:

  git status   # new/removed themes, scripts, etc.
  git diff     # actual content changes

New wallpaper referenced by a theme.conf? Also run
scripts/collect-wallpapers.sh before committing - this script doesn't touch
wallpapers/.
EOF
