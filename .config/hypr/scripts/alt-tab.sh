#!/bin/bash
# Cross-workspace Alt+Tab. Hyprland's own "cyclenext" dispatcher only cycles
# windows on the CURRENT workspace in this build (no config-level way to
# widen that scope), so this does it manually via hyprctl: build the list of
# every mapped, non-minimized window, find where the active window sits in
# that list, and focus the next/previous one - regardless of workspace.
DIR="${1:-next}"

ACTIVE=$(hyprctl activewindow -j | jq -r '.address // empty')
# xwaylandvideobridge is a 1x1 transparent background helper (see the
# hide-xwaylandvideobridge rule in ../windowrules.conf) - it used to be
# excluded for free by living on a special workspace, so it needs its own
# skip now that it sits on a normal one.
mapfile -t ADDRS < <(hyprctl clients -j | jq -r '
  [.[]
   | select(.mapped == true)
   | select(.workspace.name | startswith("special") | not)
   | select(.class != "xwaylandvideobridge")]
  | .[].address
')

N=${#ADDRS[@]}
[ "$N" -le 1 ] && exit 0

IDX=-1
for i in "${!ADDRS[@]}"; do
  if [ "${ADDRS[$i]}" = "$ACTIVE" ]; then
    IDX=$i
    break
  fi
done
[ "$IDX" -eq -1 ] && IDX=0

if [ "$DIR" = "prev" ]; then
  NEXT=$(( (IDX - 1 + N) % N ))
else
  NEXT=$(( (IDX + 1) % N ))
fi

hyprctl dispatch focuswindow "address:${ADDRS[$NEXT]}"
hyprctl dispatch bringactivetotop
