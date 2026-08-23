import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function DesktopWidget(gdkmonitor: Gdk.Monitor) {
  const { LEFT, TOP, BOTTOM} = Astal.WindowAnchor

  return (
    <window
      name="desktop-widget"
      namespace="desktop-widget"
      class="DesktopWidget"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.BACKGROUND}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={LEFT}
      application={app}
      visible
    >
      <box class="widget-group">
      </box>
    </window>
  )
}
