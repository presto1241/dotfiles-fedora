#!/bin/bash
# Toggle a "maximize" that never enters Hyprland's fullscreen state, unlike
# the `fullscreen, 1` dispatcher this replaces. A fullscreen-state window is
# painted in Hyprland's dedicated fullscreen render pass, which is hardcoded
# to sit BELOW ordinary floating windows - no z-order dispatch can override
# that, so clicking back into a maximized window never brought it back on
# top of an overlapping floating window (e.g. a browser over the Unity
# Editor). Staying a plain oversized floating window keeps it subject to
# normal z-order, so auto-raise.sh's bringactivetotop-on-focus actually
# works on it.
set -euo pipefail

# Extra left/right inset on top of the monitor's reserved area and border,
# so the maximized window's edge borders don't sit flush against the
# panel/screen edge (looks off on this IPS monitor). Adjust freely.
SIDE_PADDING=4

STATE_DIR="$HOME/.cache/hypr/pseudo-maximize"
mkdir -p "$STATE_DIR"

ACTIVE=$(hyprctl activewindow -j)
ADDR=$(jq -r .address <<<"$ACTIVE")
STATE_FILE="$STATE_DIR/${ADDR#0x}"

# Clean up windows still in Hyprland's real fullscreen/maximize state from
# before this script existed (or toggled some other way, e.g. a titlebar
# button) - exiting it snaps back to the pre-fullscreen floating geometry,
# which is what we want to treat as "original" below.
if [[ "$(jq -r .fullscreen <<<"$ACTIVE")" != "0" ]]; then
    hyprctl dispatch fullscreen 0 >/dev/null
    ACTIVE=$(hyprctl activewindow -j)
fi

if [[ -f "$STATE_FILE" ]]; then
    # Second press: restore the geometry we saved before maximizing.
    read -r X Y W H <"$STATE_FILE"
    # resizeactive anchors on the window's center, not its top-left, so it
    # must run before moveactive - otherwise the resize drags the top-left
    # away from the position moveactive just set, by half the size delta.
    hyprctl --batch "dispatch resizeactive exact $W $H; dispatch moveactive exact $X $Y"
    rm -f "$STATE_FILE"
else
    # First press: save current geometry, then fill the monitor's usable area.
    CX=$(jq -r '.at[0]' <<<"$ACTIVE")
    CY=$(jq -r '.at[1]' <<<"$ACTIVE")
    CW=$(jq -r '.size[0]' <<<"$ACTIVE")
    CH=$(jq -r '.size[1]' <<<"$ACTIVE")
    echo "$CX $CY $CW $CH" >"$STATE_FILE"

    MON_ID=$(jq -r .monitor <<<"$ACTIVE")
    MON=$(hyprctl monitors -j | jq ".[] | select(.id == $MON_ID)")
    MX=$(jq -r .x <<<"$MON")
    MY=$(jq -r .y <<<"$MON")
    MW=$(jq -r .width <<<"$MON")
    MH=$(jq -r .height <<<"$MON")
    SCALE=$(jq -r .scale <<<"$MON")
    RL=$(jq -r '.reserved[0]' <<<"$MON")
    RT=$(jq -r '.reserved[1]' <<<"$MON")
    RR=$(jq -r '.reserved[2]' <<<"$MON")
    RB=$(jq -r '.reserved[3]' <<<"$MON")
    BORDER=$(hyprctl getoption general:border_size -j | jq -r .int)

    read -r NX NY NW NH <<<"$(python3 -c "
mx, my, mw, mh, scale = $MX, $MY, $MW, $MH, $SCALE
rl, rt, rr, rb, border, pad = $RL, $RT, $RR, $RB, $BORDER, $SIDE_PADDING
lw, lh = mw / scale, mh / scale
print(int(mx + rl + border + pad), int(my + rt + border), int(lw - rl - rr - 2 * border - 2 * pad), int(lh - rt - rb - 2 * border))
")"

    hyprctl --batch "dispatch resizeactive exact $NW $NH; dispatch moveactive exact $NX $NY"
fi
