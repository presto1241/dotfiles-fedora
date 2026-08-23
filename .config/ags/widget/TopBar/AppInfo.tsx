import { createPoll } from "ags/time"
import fetch from "ags/fetch"
import { Gtk } from "ags/gtk4"
import Hyprland from "gi://AstalHyprland?version=0.1"
import Pango from "gi://Pango?version=1.0"
import { createBinding } from "ags"
import Gio from "gi://Gio?version=2.0"
import GioUnix from "gi://GioUnix?version=2.0"

const appNameCache = new Map<string, string>()

function appNameForClass(wmClass: string): string {
  if (!wmClass) return "Desktop"
  if (appNameCache.has(wmClass)) return appNameCache.get(wmClass)!

  const match = Gio.AppInfo.get_all().find((info): info is GioUnix.DesktopAppInfo => {
    if (!(info instanceof GioUnix.DesktopAppInfo)) return false
    return info.get_startup_wm_class()?.toLowerCase() === wmClass.toLowerCase()
  })

  const name =
    match?.get_display_name() ||
    wmClass
      .split(/[-_.]/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")

  appNameCache.set(wmClass, name)
  return name
}


export default function AppInfo() {
  const hyprland = Hyprland.get_default()
  const focusedApp = createBinding(hyprland, "focusedClient", "class").as((c) =>
    appNameForClass(c ?? ""),
  )

  return (
    <label
      label={focusedApp}
      ellipsize={Pango.EllipsizeMode.END}
      maxWidthChars={40}
    />
  )
}
