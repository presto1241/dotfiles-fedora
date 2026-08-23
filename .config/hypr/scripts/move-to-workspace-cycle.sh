#!/bin/bash
# Moves the focused window to the prev/next workspace on its current
# monitor, and follows it. Like plain "movetoworkspace m-1/m+1", except
# going past the LAST existing workspace creates a fresh empty one instead
# of wrapping back to the first - Hyprland's own workspace selectors don't
# have a way to express "cycle the existing set, but overflow into a new
# one at the end" in one dispatch, so this does it manually. Going past the
# FIRST workspace still just wraps normally (no "new" concept going
# backwards). Empty workspaces you don't end up using clean themselves up
# automatically once you leave them, so this never accumulates clutter.
DIR="${1:-next}"

MONITOR=$(hyprctl monitors -j | jq -r '.[] | select(.focused==true) | .name')
CURRENT=$(hyprctl monitors -j | jq -r '.[] | select(.focused==true) | .activeWorkspace.id')

mapfile -t IDS < <(hyprctl workspaces -j | jq -r --arg mon "$MONITOR" '[.[] | select(.monitor==$mon) | .id] | sort | .[]')

N=${#IDS[@]}
IDX=-1
for i in "${!IDS[@]}"; do
    if [ "${IDS[$i]}" = "$CURRENT" ]; then
        IDX=$i
        break
    fi
done
[ "$IDX" -eq -1 ] && IDX=0

if [ "$DIR" = "prev" ]; then
    if [ "$IDX" -eq 0 ]; then
        TARGET="${IDS[$((N - 1))]}"
    else
        TARGET="${IDS[$((IDX - 1))]}"
    fi
else
    if [ "$IDX" -eq $((N - 1)) ]; then
        TARGET="emptynm"
    else
        TARGET="${IDS[$((IDX + 1))]}"
    fi
fi

hyprctl dispatch movetoworkspace "$TARGET"
