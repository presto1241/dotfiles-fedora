#!/bin/bash
# Hyprland's focuswindow dispatcher (what nwg-panel's dock uses when you
# click an app icon) changes keyboard focus and warps the cursor there, but
# doesn't raise the window above overlapping floating siblings - only the
# separate "bringactivetotop" dispatcher does that, and nothing calls it
# automatically. This listens on Hyprland's event socket and calls it after
# every focus change, so any focus change (dock clicks, Alt+Tab, anything)
# actually brings the window to the front, not just gives it input.
SOCK="$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock"

socat -U - UNIX-CONNECT:"$SOCK" | while read -r line; do
    case "$line" in
        activewindowv2\>\>*)
            hyprctl dispatch bringactivetotop >/dev/null 2>&1
            ;;
    esac
done
