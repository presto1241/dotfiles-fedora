import { createBinding, createState, onCleanup, For } from "ags"
import { Gtk } from "ags/gtk4"
import Tray from "gi://AstalTray?version=0.1"

function TrayButton(item: Tray.TrayItem) {
  const icon = <image gicon={createBinding(item, "gicon")} pixelSize={16} />
  const tooltipText = createBinding(item, "title")

  // Not every tray app provides a menu - some (simple volume/network style
  // utilities) only expect a left click to activate them directly. Without
  // this branch those would get a menubutton popping open on an empty
  // PopoverMenu instead of doing anything.
  if (!item.menu_model) {
    return (
      <button tooltipText={tooltipText} onClicked={() => item.activate(0, 0)}>
        {icon}
      </button>
    )
  }

  const popover = new Gtk.PopoverMenu({ menuModel: item.menu_model })

  // action-group is what actually makes clicking a menu entry do something -
  // it's looked up by the "dbusmenu" prefix used below, and per Astal's own
  // reference impl it can be reassigned after the item's already up, so this
  // has to stay live rather than a one-time insert at creation.
  function syncActionGroup() {
    popover.insert_action_group("dbusmenu", item.action_group)
  }
  syncActionGroup()
  const id = item.connect("notify::action-group", syncActionGroup)
  onCleanup(() => item.disconnect(id))

  return (
    <menubutton popover={popover} tooltipText={tooltipText}>
      {icon}
    </menubutton>
  )
}

export default function SystemTray() {
  const [trayOpen, setTrayOpen] = createState(false)
  const tray = Tray.get_default()
  const items = createBinding(tray, "items")

  return (
    <box>
      <revealer
        revealChild={trayOpen}
        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
        transitionDuration={200}
      >
        <box spacing={4} class="tray-items">
          <For each={items}>{TrayButton}</For>
        </box>
      </revealer>

      <button
        class={trayOpen.as((v) => (v ? "system-tray active" : "system-tray"))}
        onClicked={() => setTrayOpen((v) => !v)}
      >
        <image iconName="go-next" pixelSize={12} />
      </button>
    </box>
  )
}
