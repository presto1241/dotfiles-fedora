import { Gtk } from "ags/gtk4"
import Adw from "gi://Adw?version=1"
import Gdk from "gi://Gdk?version=4.0"
import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"

// AGS links libadwaita, and libadwaita deliberately refuses to honour
// gtk-theme-name: on init it replaces the setting with the stub theme
// "Adwaita-empty" and loads its own stylesheet instead. That is why the bar
// renders in Adwaita's palette (#222226 window background) no matter what the
// desktop GTK theme is set to.
//
// Pointing gtk-theme-name back at the real theme *after* init makes GTK load
// that theme's gtk.css on top of libadwaita's, which is enough for the named
// colours scss/_variables.scss already uses (@theme_bg_color, @theme_fg_color,
// @borders) to resolve to the desktop's palette. libadwaita's own colours
// (@window_bg_color, @accent_bg_color, ...) stay defined as a fallback for
// anything a GTK3-era theme doesn't provide.
//
// Doing this at runtime rather than via GTK_THEME= in the launch environment
// means a theme change takes effect live, without restarting ags.

const INTERFACE_SCHEMA = "org.gnome.desktop.interface"

// The active theme pack, via the symlink apply.sh repoints.
const PALETTE = `${GLib.get_user_config_dir()}/themes/current/palette.css`

// GTK parses ~/.config/gtk-4.0/gtk.css - and the palette.css it imports -
// exactly once, at startup. Measured against GTK 4.22.4: a GtkCssProvider
// never notices its file changing, and picks the change up the instant
// load_from_path() is called by hand. So editing palette.css and re-running
// apply.sh cannot reach a running bar on its own; this does the reload.
//
// Only palette.css is re-loaded, never the whole gtk.css. palette.css is
// nothing but @define-color declarations, so it can redefine colour names
// without bringing along any rule that could outrank the bar's own styling.
//
// Priority matters and is tight: ags applies its stylesheet at PRIORITY_USER
// (see ags/lib/gtk4/app.ts), and GTK's own now-stale copy of palette.css sits
// at PRIORITY_USER too. USER + 1 is therefore the only slot that beats the
// stale definitions without outranking a single one of the bar's rules.
let paletteProvider: Gtk.CssProvider | null = null

function reloadPalette() {
  if (!GLib.file_test(PALETTE, GLib.FileTest.EXISTS)) return

  const display = Gdk.Display.get_default()
  if (!display) return

  if (!paletteProvider) {
    paletteProvider = new Gtk.CssProvider()
    Gtk.StyleContext.add_provider_for_display(
      display,
      paletteProvider,
      Gtk.STYLE_PROVIDER_PRIORITY_USER + 1,
    )
  }

  paletteProvider.load_from_path(PALETTE)
}

let interfaceSettings: Gio.Settings | null | undefined

// Held at module scope: a collected Gio.Settings stops emitting "changed".
function settings(): Gio.Settings | null {
  if (interfaceSettings !== undefined) return interfaceSettings

  // Not every system has the gsettings-desktop-schemas installed, and there is
  // no way to probe for a schema without asserting on a miss.
  const schema = Gio.SettingsSchemaSource.get_default()?.lookup(INTERFACE_SCHEMA, true)
  interfaceSettings = schema ? new Gio.Settings({ settingsSchema: schema }) : null

  return interfaceSettings
}

function applyGtkTheme() {
  const name = settings()?.get_string("gtk-theme")
  const gtk = Gtk.Settings.get_default()
  if (name && gtk) gtk.gtkThemeName = name
}

function applyColorScheme() {
  // gtk-application-prefer-dark-theme is the GTK3 way and libadwaita warns
  // about it at startup; AdwStyleManager is the supported equivalent.
  const scheme = settings()?.get_string("color-scheme")

  Adw.StyleManager.get_default().colorScheme =
    scheme === "prefer-dark"
      ? Adw.ColorScheme.FORCE_DARK
      : scheme === "prefer-light"
        ? Adw.ColorScheme.FORCE_LIGHT
        : Adw.ColorScheme.DEFAULT
}

/** Make the bar track the desktop GTK theme, now and on every later change. */
export default function followGtkTheme() {
  const desktop = settings()

  // apply.sh bounces gtk-theme through a sentinel so this fires even when the
  // theme name has not changed - which is the case whenever palette.css alone
  // was edited. Skip the sentinel itself; the real name lands a moment later.
  desktop?.connect("changed::gtk-theme", () => {
    if (settings()?.get_string("gtk-theme") === "__theme_reload__") return
    applyGtkTheme()
    reloadPalette()
  })
  desktop?.connect("changed::color-scheme", applyColorScheme)

  applyGtkTheme()
  applyColorScheme()
  reloadPalette()
}
