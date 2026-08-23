import app from "ags/gtk4/app"
import { Astal, Gdk } from "ags/gtk4"
import Workspaces from "./Workspaces"

export default function AppBar(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      name="app-bar"
      class="AppBar"
      namespace="app-bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={BOTTOM}
      application={app}
      defaultWidth={1}
    >
      <centerbox cssName="centerbox">
        <box $type="center">
          <Workspaces gdkmonitor={gdkmonitor} />
        </box>
      </centerbox>
    </window>
  )
}
