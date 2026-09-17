import Gio from "gi://Gio"
import GioUnix from "gi://GioUnix?version=2.0"
import Gtk from "gi://Gtk?version=4.0"
import Gdk from "gi://Gdk?version=4.0"
import GLib from "gi://GLib"

// Hyprland's Client.class is the raw window class Wayland/X11 reports,
// which doesn't always match the icon name an app's own .desktop file
// declares (e.g. Zen Browser's class is "zen" but its icon is registered
// as "zen-browser"; Pulsemeeter's class is the reverse-DNS
// "org.pulsemeeter.pulsemeeter" but its icon is "Pulsemeeter"). Icon theme
// lookup is exact-string and case-sensitive, so these never resolve on
// their own - this builds a class -> icon name table from every installed
// .desktop file's StartupWMClass and desktop id, once, up front.
const byWmClass = new Map<string, string>()
const byDesktopId = new Map<string, string>()

for (const info of Gio.AppInfo.get_all()) {
  const icon = info.get_icon()?.to_string()
  if (!icon) continue

  const id = info.get_id()
  if (id) byDesktopId.set(id.replace(/\.desktop$/, "").toLowerCase(), icon)

  if (info instanceof GioUnix.DesktopAppInfo) {
    const wmClass = info.get_startup_wm_class()
    if (wmClass) {
      const normalized = wmClass.toLowerCase()
      byWmClass.set(normalized, icon)
      // WINE's auto-generated .desktop entries for Windows apps declare
      // StartupWMClass with a ".exe" suffix (e.g. "unity.exe"), but the
      // actual XWayland WM_CLASS the running window reports never has it -
      // so index both forms.
      if (normalized.endsWith(".exe")) {
        byWmClass.set(normalized.slice(0, -".exe".length), icon)
      }
    }
  }
}

// Steam never runs winemenubuilder for its per-title Proton prefixes, so
// games get no .desktop entry at all - byWmClass/byDesktopId above have
// nothing to match them against, and the raw window class is usually
// exe-derived garbage. Steam does drop a steam_icon_<appid>.png into the
// hicolor theme for every installed app though (it's what Steam's own
// taskbar entries use), so recovering the AppID gets a real icon for free.
// It isn't exposed on the window, but Steam sets it in the launched
// process's environment (SteamAppId / STEAM_COMPAT_APP_ID) and wine/proton
// inherit environment across exec, so /proc/<pid>/environ still has it.
function steamIconForPid(pid: number): string | undefined {
  try {
    const [ok, contents] = GLib.file_get_contents(`/proc/${pid}/environ`)
    if (!ok) return undefined

    const env = new TextDecoder().decode(contents)
    for (const entry of env.split("\0")) {
      const match = /^(?:SteamAppId|STEAM_COMPAT_APP_ID)=(\d+)$/.exec(entry)
      if (match) return `steam_icon_${match[1]}`
    }
  } catch {
    // Process already gone, or /proc/<pid>/environ unreadable - not a
    // Steam/Proton window then, just fall through to the other candidates.
  }
  return undefined
}

export function iconForClass(clientClass: string, pid?: number): string {
  const key = clientClass.toLowerCase()
  // Reverse-DNS style classes (org.foo.Bar) rarely match a desktop id
  // directly, but their last segment usually does.
  const lastSegment = key.split(".").pop() ?? key

  // An app can have more than one installed .desktop file claiming the same
  // StartupWMClass/id with different Icon= values (e.g. a user override in
  // ~/.local/share/applications shadowing the system one) - and the one
  // that wins isn't guaranteed to name an icon that actually exists in the
  // *current* icon theme. Walk every candidate name in priority order and
  // use the first one the active theme can really resolve, so a bad or
  // theme-mismatched Icon= value falls through instead of rendering as a
  // broken-image glyph.
  const candidates = [
    byWmClass.get(key),
    byDesktopId.get(key),
    byDesktopId.get(lastSegment),
    pid !== undefined ? steamIconForPid(pid) : undefined,
    clientClass,
  ].filter((name): name is string => Boolean(name))

  const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
  for (const candidate of candidates) {
    if (theme.has_icon(candidate)) return candidate
  }

  return clientClass
}

// Notifications and windows identify their app completely differently - a
// notification carries a human-readable appName (always) and a desktop-entry
// hint (only if the sender bothered to set it), while a window only has its
// raw WM_CLASS. There's no direct way to compare the two, so instead this
// resolves the notification through the exact same byWmClass/byDesktopId
// tables iconForClass uses and returns the icon name it lands on - matching
// a notification to a taskbar button then just means comparing the two
// resolved icon names, the same identity iconForClass already trusted to
// paint the right glyph.
export function iconForNotification(appName: string, desktopEntry?: string): string {
  const entryKey = desktopEntry?.replace(/\.desktop$/, "").toLowerCase()
  const nameKey = appName.toLowerCase()

  const candidates = [
    entryKey ? byDesktopId.get(entryKey) : undefined,
    entryKey ? byWmClass.get(entryKey) : undefined,
    byDesktopId.get(nameKey),
    byWmClass.get(nameKey),
    appName,
  ].filter((name): name is string => Boolean(name))

  const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
  for (const candidate of candidates) {
    if (theme.has_icon(candidate)) return candidate
  }

  return appName
}
