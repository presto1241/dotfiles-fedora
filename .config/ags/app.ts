import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/TopBar/Bar"
import AppBar from "./widget/AppBar/AppBar"
import StripBar from "./widget/AppBar/StripBar"
import DesktopWidget from "./widget/DesktopWidget"
import NotificationPopups from "./widget/Notifications/NotificationPopups"
import { APP_BAR_LOCATION, pickPrimaryConnector } from "./config"
import followGtkTheme from "./theme"

app.start({
  css: style,
  main() {
    followGtkTheme()

    const primaryConnector = pickPrimaryConnector(app.get_monitors())
    var primary = app
    .get_monitors()
    .filter((m) => m.connector === primaryConnector)
    primary.map(Bar)
    primary.map(DesktopWidget)
    if (APP_BAR_LOCATION === "bottom") primary.map(AppBar)

    if (APP_BAR_LOCATION === "top")
      app
        .get_monitors()
        .filter((m) => m.connector !== primaryConnector)
        .map(StripBar)

    // Constructing this is what claims org.freedesktop.Notifications on the
    // session bus. Nothing else on the system owns it - Fedora only ships
    // KDE's plasma_waitforname activation stub, which never resolves under
    // Hyprland - so without this every notify-send blocks until DBus times
    // out. That stall is what was freezing Heroic's Electron main loop at
    // startup and making Hyprland offer to kill it.
    primary.map(NotificationPopups)
  },
})
