import { Gtk } from "ags/gtk4"

export default function Home() {
  return (
    <menubutton>
      <image iconName="user-home" pixelSize={14}/>
      <popover hasArrow={false}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          <button>
            <box>
              <image iconName="system-log-out" pixelSize={14}/>
              <label label="Logout"/>
            </box>
          </button>

          <button>
            <box>
              <image iconName="system-reboot" pixelSize={14}/>
              <label label="Restart"/>
            </box>
          </button>

          <button>
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
