#!/bin/bash
# Minimize/restore the focused window, mirroring exactly what clicking its
# dock button in the ags app bar does - see toggleMinimize() in
# ~/.config/ags/widget/AppBar/Workspaces.tsx, which this is a keybind-only
# copy of.
#
# One special workspace PER MONITOR, "special:minimized-<monitor-name>", not
# a single shared "special:minimized" - named special workspaces are global
# in Hyprland, so one shared name would pool every monitor's minimized
# windows into one bucket instead of keeping each monitor's separate.

active="$(hyprctl activewindow -j)"
address="$(jq -r '.address' <<<"$active")"
[[ -z "$address" || "$address" == "null" ]] && exit 0

mon_id="$(jq -r '.monitor' <<<"$active")"
ws_name="$(jq -r '.workspace.name' <<<"$active")"
mon_name="$(hyprctl monitors -j | jq -r --arg id "$mon_id" 'first(.[] | select((.id|tostring) == $id) | .name)')"
minimized_ws="special:minimized-$mon_name"

if [[ "$ws_name" == "$minimized_ws" ]]; then
    # restore: bring it back to wherever you currently are
    current_ws="$(hyprctl activeworkspace -j | jq -r '.id')"
    hyprctl dispatch movetoworkspace "$current_ws,address:$address"
else
    # minimize: park it, without switching your view to follow it there
    hyprctl dispatch movetoworkspacesilent "$minimized_ws,address:$address"
fi
