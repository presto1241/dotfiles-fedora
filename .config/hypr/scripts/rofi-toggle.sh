#!/bin/bash
# Makes tap-Super behave like a toggle, and closes rofi when focus leaves it.
#
# rofi's own -click-to-exit (on by default) can't do either of those here:
# it runs as a layer-shell surface, not an xdg_popup or toplevel, and
# Wayland has no "you lost focus" signal for that surface type - X11 did,
# which is what -click-to-exit actually relies on. Confirmed by watching
# Hyprland's event socket while dispatching focus elsewhere with rofi open:
# no activewindow event fires and rofi never closes.
#
# Second tap = close: keybinds.conf's bindr fires this script on every tap
# of bare Super, so if rofi is already running, killing it here IS the
# second tap's behaviour - it just doesn't fall through to relaunching it.
if pgrep -x rofi >/dev/null; then
    pkill -x rofi
    exit 0
fi

rofi -modi drun,calc -show drun -no-persist-history -no-history -theme ~/.config/rofi/style-1.rasi &
ROFI_PID=$!

# Click away = close: watch for the first REAL window taking focus.
# activewindow only fires for toplevel windows - rofi itself never
# generates one, since it's a layer surface - so the first one seen after
# rofi opens reliably means the user clicked (or alt-tabbed to) something
# else, not that rofi just opened.
SOCK="$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock"
(
    socat -u UNIX-CONNECT:"$SOCK" - 2>/dev/null | while IFS= read -r line; do
        case "$line" in
            activewindow\>\>*)
                kill "$ROFI_PID" 2>/dev/null
                break
                ;;
        esac
    done
) &
WATCHER_PID=$!

wait "$ROFI_PID" 2>/dev/null
kill "$WATCHER_PID" 2>/dev/null
