import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/TopBar/Bar"
import AppBar from "./widget/AppBar/AppBar"
import DesktopWidget from "./widget/DesktopWidget"
import NotificationPopups from "./widget/Notifications/NotificationPopups"
import { PRIMARY_MONITOR } from "./config"
import followGtkTheme from "./theme"

app.start({
  css: style,
  main() {
    followGtkTheme()

    var primary = app
    .get_monitors()
    .filter((m) => m.connector === PRIMARY_MONITOR)
    primary.map(Bar)
    primary.map(DesktopWidget)
    primary.map(AppBar)

    // Constructing this is what claims org.freedesktop.Notifications on the
    // session bus. Nothing else on the system owns it - Fedora only ships
    // KDE's plasma_waitforname activation stub, which never resolves under
    // Hyprland - so without this every notify-send blocks until DBus times
    // out. That stall is what was freezing Heroic's Electron main loop at
    // startup and making Hyprland offer to kill it.
    primary.map(NotificationPopups)
  },
})
