import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"

// Logout goes through Hyprland's own "exit" dispatcher (same as the
// $mainMod+SHIFT+E keybind in keybinds.conf) rather than loginctl/uwsm
// directly, so both paths tear the session down identically. Restart and
// shutdown aren't compositor-scoped, so those go straight to systemd.
function logout() {
  execAsync(["hyprctl", "dispatch", "exit"]).catch(console.error)
}

function restart() {
  execAsync(["systemctl", "reboot"]).catch(console.error)
}

function shutdown() {
  execAsync(["systemctl", "poweroff"]).catch(console.error)
}

export default function Home() {
  return (
    <menubutton>
      <image iconName="user-home" pixelSize={14}/>
      <popover hasArrow={false}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          <button onClicked={logout}>
            <box>
              <image iconName="system-log-out" pixelSize={14}/>
              <label label="Logout"/>
            </box>
          </button>

          <button onClicked={restart}>
            <box>
              <image iconName="system-reboot" pixelSize={14}/>
              <label label="Restart"/>
            </box>
          </button>

          <button onClicked={shutdown}>
            <box>
              <image iconName="system-shutdown" pixelSize={14}/>
              <label label="Shutdown"/>
            </box>
          </button>
        </box>
      </popover>
    </menubutton>
  )
}
