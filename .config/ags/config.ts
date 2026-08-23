// GTK4/Wayland has no native "primary monitor" concept, so this is manual.
// Match against Gdk.Monitor.connector (e.g. "DP-1", "HDMI-A-1").
export const PRIMARY_MONITOR = "HDMI-A-1"

// Icon theme the bar draws its own glyphs from (weather, brightness, ...),
// deliberately pinned rather than following gtk-icon-theme-name - see
// widget/icons.ts for why. The system tray is unaffected and keeps using the
// desktop icon theme, since those icons belong to the apps, not to the bar.
export const BAR_ICON_THEME = "Adwaita"
