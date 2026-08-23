#!/usr/bin/env bash
# Dev-time helper (not run by install.sh): finds every wallpaper path
# referenced by tracked configs (theme.conf `wallpaper=` keys, and the
# swww/hyprpaper calls in hypr scripts) and copies just those files into
# ./wallpapers/, preserving their ~/Pictures/Wallpapers/<Category>/ subpath
# so install.sh can put them back in the right place on a new machine.
#
# Run this after adding a theme or changing a wallpaper path, then commit
# whatever shows up under wallpapers/.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SRC"

mapfile -t paths < <(
    grep -rhoE '(wallpaper[[:space:]]*=[[:space:]]*|swww img[[:space:]]+"|swww[[:space:]]+img[[:space:]]+)[^"'"'"']*' \
        .config/themes/*/theme.conf .config/hypr/scripts/*.sh 2>/dev/null \
    | sed -E 's/^(wallpaper[[:space:]]*=[[:space:]]*|swww img[[:space:]]+"?|swww[[:space:]]+img[[:space:]]+"?)//' \
    | sed -E "s|^~|$HOME|; s|^\\\$HOME|$HOME|" \
    | sort -u
)

for p in "${paths[@]}"; do
    if [ ! -f "$p" ]; then
        echo "skip (not found): $p" >&2
        continue
    fi
    rel="${p#"$HOME"/Pictures/Wallpapers/}"
    if [ "$rel" = "$p" ]; then
        echo "skip (outside ~/Pictures/Wallpapers, copy manually): $p" >&2
        continue
    fi
    dest="wallpapers/$rel"
    mkdir -p "$(dirname "$dest")"
    cp -n "$p" "$dest"
    echo "collected: $rel"
done
