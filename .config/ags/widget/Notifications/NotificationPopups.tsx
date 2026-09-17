import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, onCleanup, For } from "ags"
import { timeout, type Timer } from "ags/time"
import Notifd from "gi://AstalNotifd?version=0.1"
import Notification from "./Notification"

// How long a popup stays up when the sender didn't ask for anything specific.
// Senders CAN specify their own expireTimeout, which is honoured below.
const DEFAULT_TIMEOUT_MS = 5000

export default function NotificationPopups(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT } = Astal.WindowAnchor

  // This call is the entire point of the widget: constructing the Notifd
  // singleton is what makes this process acquire the org.freedesktop.Notifications
  // DBus name. Without *something* owning that name, every notify-send on the
  // system blocks until DBus gives up trying to activate KDE's
  // plasma_waitforname stub, which never resolves outside a Plasma session.
  const notifd = Notifd.get_default()

  // Popups are deliberately NOT notifd.notifications. That property is the
  // list of everything unresolved, which persists until a client acks it -
  // fine for a history panel, wrong for transient toasts. This is our own
  // short-lived view.
  const [popups, setPopups] = createState<Array<Notifd.Notification>>([])
  const timers = new Map<number, Timer>()

  function drop(id: number) {
    timers.get(id)?.cancel()
    timers.delete(id)
    setPopups((list) => list.filter((n) => n.id !== id))
  }

  function push(n: Notifd.Notification) {
    // A sender reusing an id (replaces_id) mutates the existing object, so
    // clear any prior entry and re-add rather than ending up with the same
    // notification listed twice on a stale timer.
    timers.get(n.id)?.cancel()
    timers.delete(n.id)
    setPopups((list) => [...list.filter((p) => p.id !== n.id), n])

    // Urgency CRITICAL means "must not expire on its own" per the spec - the
    // user has to dismiss or action it.
    if (n.urgency === Notifd.Urgency.CRITICAL) return

    // expireTimeout is the raw DBus expire_timeout: >0 is a specific ms
    // value, 0 explicitly means "never expire" (the sender's call, distinct
    // from CRITICAL), and -1 means "sender has no preference" - only that
    // last case should fall back to our default.
    if (n.expireTimeout === 0) return

    const ms = n.expireTimeout > 0 ? n.expireTimeout : DEFAULT_TIMEOUT_MS
    timers.set(
      n.id,
      timeout(ms, () => drop(n.id)),
    )
  }

  const onNotified = notifd.connect("notified", (_, id) => {
    if (notifd.dontDisturb) return
    const n = notifd.get_notification(id)
    if (n) push(n)
  })

  // "resolved" covers dismissal from anywhere - our close button, the sender
  // withdrawing it, or an action being invoked - so the popup disappears in
  // all of those cases and not just on our own timer.
  const onResolved = notifd.connect("resolved", (_, id) => drop(id))

  onCleanup(() => {
    notifd.disconnect(onNotified)
    notifd.disconnect(onResolved)
    timers.forEach((t) => t.cancel())
    timers.clear()
  })

  return (
    <window
      name="notifications"
      namespace="notifications"
      class="Notifications"
      gdkmonitor={gdkmonitor}
      // TOP rather than OVERLAY on purpose: Hyprland stacks fullscreen
      // windows above the TOP layer, so a toast can't paint itself over a
      // game. OVERLAY would sit on top of Rocket League mid-match.
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={TOP | RIGHT}
      application={app}
      // An empty layer-shell surface still takes a hit for input and blur, so
      // the whole window goes away when there is nothing to show.
      visible={popups.as((list) => list.length > 0)}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.START}>
        <For each={popups}>{(n: Notifd.Notification) => Notification(n)}</For>
      </box>
    </window>
  )
}
