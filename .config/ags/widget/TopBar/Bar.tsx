import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createBinding } from "ags"
import Hyprland from "gi://AstalHyprland?version=0.1"

// Project Widgets
import Weather from "./Weather"
import Clock from "./Clock"
import SystemTray from "./SystemTray"
import AppInfo from "./AppInfo"
import SystemInfo from "./SystemInfo"
import Home from "./HomeMenu"
import MediaControls from "./MediaControls"
import MonitorBrightness from "./MonitorBrighness"
import ThemeSwitcher from "./ThemeSwitcher"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const hyprland = Hyprland.get_default()
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      class="Bar"
      namespace="top-bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox">
        <box $type="start" class="widget-group">
          <Home/>
          <AppInfo/>
        </box>

        <box $type="center" class="widget-group">
          <Weather/>
          <Clock/>
        </box>

        <box $type="end" spacing={4}>
          <box class="widget-group" spacing={4}>
            <SystemTray/>
            <MonitorBrightness/>
            <SystemInfo/>
          </box>

          <box class="widget-group">
            <ThemeSwitcher/>
          </box>
        </box>
      </centerbox>
    </window>
  )
}
