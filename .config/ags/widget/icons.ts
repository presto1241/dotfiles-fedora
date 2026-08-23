import { Gtk } from "ags/gtk4"
import { BAR_ICON_THEME } from "../config"

// Bar glyphs are looked up from one pinned icon theme instead of the desktop's
// gtk-icon-theme-name, because most icon packs are unusable at bar size:
//
//  - They author status icons at 48px with 2px strokes. Scaled to ~16px the
//    strokes land at 0.6px and the shape collapses - Amy-Dark-Icons'
//    weather-clear-symbolic renders as a plain white dot.
//  - GTK's symbolic recolouring rewrites `fill` and never `stroke`, so a
//    stroke-drawn "-symbolic" icon keeps whatever colour it was authored with
//    and ignores the label colour entirely.
//
// Adwaita's status icons are drawn at 16px with fills only, which is what both
// problems need. Adwaita ships with GTK itself, so it is always present.
//
// A fresh Gtk.IconTheme starts with the standard XDG search path already
// populated, so only the theme name has to be set. It is created lazily: this
// module is imported before app.start() runs Gtk.init().
let theme: Gtk.IconTheme | null = null

// Adwaita's status icons are 16px originals - asking for exactly 16 keeps them
// on the pixel grid instead of resampling to a blur.
export const ICON_SIZE = 12

export function symbolic(name: string): Gtk.IconPaintable {
  theme ??= new Gtk.IconTheme({ themeName: BAR_ICON_THEME })

  return theme.lookup_icon(
    name,
    null,
    ICON_SIZE,
    1,
    Gtk.TextDirection.NONE,
    Gtk.IconLookupFlags.FORCE_SYMBOLIC,
  )
}
