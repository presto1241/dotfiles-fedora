#!/bin/bash
# Prioritize the YouTube Music PWA over any other MPRIS player (e.g. a
# YouTube video paused in a regular Firefox tab) for the media keys. The PWA
# still shows up as a generic "firefox.instance_N" player like any other
# Firefox window - firefoxpwa doesn't give it its own D-Bus name - so it has
# to be picked out by checking which instance's current track URL is on
# music.youtube.com, since the instance number isn't stable across restarts.
CMD="$1"

YTM_PLAYER=""
for p in $(playerctl -l 2>/dev/null); do
    url=$(playerctl -p "$p" metadata xesam:url 2>/dev/null)
    if [[ "$url" == *music.youtube.com* ]]; then
        YTM_PLAYER="$p"
        break
    fi
done

if [ -n "$YTM_PLAYER" ]; then
    playerctl -p "$YTM_PLAYER" "$CMD"
else
    playerctl "$CMD"
fi
