import Gdk from "gi://Gdk?version=4.0"

// GTK4/Wayland has no native "primary monitor" concept, so this is manual.
// Preferred connectors in priority order, matched against
// Gdk.Monitor.connector (e.g. "DP-1", "HDMI-A-1"). First one plugged in wins.
export const PRIMARY_MONITORS = ["HDMI-A-1"]

/** Primary connector: a preferred one if present, else the laptop panel, else the first monitor. */
export function pickPrimaryConnector(monitors: Gdk.Monitor[]): string | null {
  const present = monitors.map((m) => m.connector)
  const preferred = PRIMARY_MONITORS.find((c) => present.includes(c))
  if (preferred) return preferred

  const internal = present.find((c) => c?.startsWith("eDP"))
  if (internal) return internal

  return present[0] ?? null
}

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
