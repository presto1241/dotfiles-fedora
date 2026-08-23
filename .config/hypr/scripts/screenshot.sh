#!/bin/bash
# Spectacle can't take screenshots under Hyprland at all - its Wayland
# backend hard-requires KWin's own screenshot D-Bus interface, which only
# exists under real Plasma (confirmed via its own error message). grim+slurp
# use the generic wlr-screencopy protocol instead, which any wlroots
# compositor implements, Hyprland included.
MODE="${1:-full}"
DIR="$HOME/Pictures/Screenshots"
mkdir -p "$DIR"
FILE="$DIR/screenshot-$(date +%Y-%m-%d_%H-%M-%S).png"

if [ "$MODE" = "region" ]; then
    GEOM=$(slurp) || exit 0
    grim -g "$GEOM" "$FILE"
else
    grim "$FILE"
fi

[ -f "$FILE" ] && wl-copy < "$FILE"
