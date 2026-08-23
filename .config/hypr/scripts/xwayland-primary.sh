#!/usr/bin/env bash
# Mark one output as the XRandR "primary" for XWayland clients.
#
# Hyprland never sets a primary output, so `xrandr` reports all three with no
# primary flag. XWayland games that ask X for "the" display (rather than
# enumerating outputs) then fall back to the output at origin 0x0 - here that
# is DP-1, the 4K Acer. Rocket League in particular has
# AllowSecondaryDisplays in its TASystemSettings.ini and will refuse anything
# that is not primary, so without this it always lands on the 4K.
#
# Setting primary also reorders `xrandr --listmonitors` so HDMI-A-1 becomes
# index 0, which is what most other Proton titles pick as their default.
PRIMARY="${1:-HDMI-A-1}"

# XWayland is started lazily, so DISPLAY may not answer for a moment after
# Hyprland comes up. Retry rather than racing it.
for _ in $(seq 30); do
    if xrandr --query >/dev/null 2>&1; then
        xrandr --output "$PRIMARY" --primary && exit 0
    fi
    sleep 1
done

exit 1
