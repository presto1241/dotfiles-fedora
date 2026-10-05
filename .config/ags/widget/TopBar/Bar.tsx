import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, createBinding } from "ags"
import Hyprland from "gi://AstalHyprland?version=0.1"

// Project Widgets
import Weather from "./Weather"
import Clock from "./Clock"
import SystemTray from "./SystemTray"
// import AppInfo from "./AppInfo" // unused - focusedClient isn't monitor-scoped anyway, WorkspaceStrip covers it
import SystemInfo from "./SystemInfo"
import Home from "./HomeMenu"
import MediaControls from "./MediaControls"
import MonitorBrightness from "./MonitorBrighness"
import ThemeSwitcher from "./ThemeSwitcher"
import WorkspaceStrip from "../AppBar/WorkspaceStrip"
import { APP_BAR_LOCATION } from "../../config"

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
        <box $type="start" class="widget-row" spacing={2}>
          <box class="widget-group" spacing={4}>
            <Home/>
            {/* <AppInfo/> */}
          </box>

          {APP_BAR_LOCATION === "top" && <WorkspaceStrip gdkmonitor={gdkmonitor}/>}
        </box>

        <box $type="center" class="widget-row" spacing={2}>
          
          <box class="widget-group">
            <Weather/>
          </box>

          <box class="widget-group">
            <Clock/>
          </box>
        </box>

        <box $type="end" class="widget-row" spacing={2}>
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
