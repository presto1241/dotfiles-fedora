// GTK4/Wayland has no native "primary monitor" concept, so this is manual.
// Match against Gdk.Monitor.connector (e.g. "DP-1", "HDMI-A-1").
export const PRIMARY_MONITOR = "HDMI-A-1"

// Where the windows-per-workspace view lives:
//   "top"    - a strip in the top bar, plus a floating one on each other monitor
//   "bottom" - the dock along the bottom of the primary monitor
// Only one at a time, so the two never show the same thing twice.
export type AppBarLocation = "top" | "bottom"
export const APP_BAR_LOCATION: AppBarLocation = "top"

// The workspace strip on the non-primary monitors floats at top-centre. With
// auto-hide on it collapses to a thin hot-zone at the screen edge and slides
// out when you hover there; off means it's always showing.
export const SECONDARY_STRIP_AUTOHIDE = true
export const SECONDARY_STRIP_HIDE_DELAY_MS = 400

// Icon theme the bar draws its own glyphs from (weather, brightness, ...),
// deliberately pinned rather than following gtk-icon-theme-name - see
// widget/icons.ts for why. The system tray is unaffected and keeps using the
// desktop icon theme, since those icons belong to the apps, not to the bar.
export const BAR_ICON_THEME = "Adwaita"
