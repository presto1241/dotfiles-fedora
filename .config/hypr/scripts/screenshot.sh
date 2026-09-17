#!/bin/bash
# Spectacle can't take screenshots under Hyprland at all - its Wayland
# backend hard-requires KWin's own screenshot D-Bus interface, which only
# exists under real Plasma (confirmed via its own error message). grimblast
# wraps grim+slurp via the generic wlr-screencopy protocol instead, which
# any wlroots compositor implements, Hyprland included. --freeze pauses the
# screen during region selection so it stops drifting out of sync.
MODE="${1:-full}"
DIR="$HOME/Pictures/Screenshots"
mkdir -p "$DIR"
FILE="$DIR/screenshot-$(date +%Y-%m-%d_%H-%M-%S).png"

if [ "$MODE" = "region" ]; then
    grimblast --freeze copysave area "$FILE"
else
    grimblast --freeze copysave screen "$FILE"
fi
