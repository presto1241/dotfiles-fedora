#!/bin/bash
# swww img doesn't reliably wait for swww-daemon's socket to be ready on
# this system - calling it right after exec-once'ing the daemon loses the
# race often enough to just show solid black. This polls until the daemon
# actually answers before setting the image.
while ! swww query >/dev/null 2>&1; do
    sleep 0.2
done

swww img "$HOME/Pictures/Wallpapers/Galaxy/starry_sky_night_stars_122563_2560x1600.jpg"
