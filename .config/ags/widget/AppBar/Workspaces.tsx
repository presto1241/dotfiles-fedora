import { createBinding, createComputed, createState, For } from "ags"
import { Gdk, Gtk } from "ags/gtk4"
import Hyprland from "gi://AstalHyprland"
import Notifd from "gi://AstalNotifd?version=0.1"
import { iconForClass, iconForNotification } from "../../appIcons"
import { ignoreRules, isIgnored } from "../../ignoredWindows"

export default function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  const workspaces = createBinding(hypr, "workspaces")
  const monitors = createBinding(hypr, "monitors")

  // Notifd.notifications is the same "everything unresolved" list
  // NotificationPopups deliberately avoids for toasts - here it's exactly
  // what's wanted, since a taskbar badge should track until dismissed/acked,
  // not disappear on the popup's own timeout.
  const notifications = createBinding(Notifd.get_default(), "notifications")

  const sortedMonitors = monitors((m) =>
    m.sort((a, b) => a.id - b.id)
  )

  return (
    <box spacing={4}>
      <For each={sortedMonitors}>
        {(m) => {
          // Minimized windows get their own special workspace, one per
          // monitor - a single shared "special:minimized" name would pool
          // every monitor's minimized windows into one bucket, since named
          // special workspaces in Hyprland are global, not per-monitor.
          const MINIMIZED = `special:minimized-${m.name}`

          function toggleMinimize(client: Hyprland.Client) {
            // AstalHyprland's Client.address is missing the "0x" prefix that
            // Hyprland's own dispatch "address:" selector requires - without
            // it the dispatch just silently matches nothing.
            const address = `0x${client.address}`
            if (client.workspace?.name === MINIMIZED) {
              // restore: bring it back to wherever you currently are
              hypr.dispatch("movetoworkspace", `${hypr.focused_workspace.id},address:${address}`)
            } else {
              // minimize: park it, without switching your view to follow it there
              hypr.dispatch("movetoworkspacesilent", `${MINIMIZED},address:${address}`)
            }
          }

          function ClientButton(client: Hyprland.Client) {
            const isFocused = createBinding(hypr, "focused_client").as(
              (focused) => focused?.address === client.address,
            )
            // client.workspace has its own notify signal, so this stays
            // correct live even if a button instance somehow outlives a move
            // between the regular and minimized <For> lists.
            const isMinimized = createBinding(client, "workspace").as(
              (ws) => ws?.name === MINIMIZED,
            )
            const buttonClass = createComputed(() =>
              [isFocused() && "active", isMinimized() && "minimized"].filter(Boolean).join(" "),
            )
            // Menus, tooltips and other transient popups are real clients as
            // far as Hyprland is concerned, so they each earn a dock button
            // unless filtered out. See ~/.config/ags/ignored-windows.conf.
            // Bound to the client's own title rather than read once, because
            // some windows (Unity's editor window) map under a placeholder
            // title and rename themselves a moment later - this way the
            // button appears as soon as that happens.
            const title = createBinding(client, "title")
            const isListed = createComputed(() =>
              !isIgnored(ignoreRules(), client.class, title()),
            )

            // GtkWidget has no hover signal of its own in GTK4 - enter/leave
            // only exist on an explicit event controller, attached by hand
            // via $ rather than an onSomething JSX prop. Attached to the
            // overlay (not the icon button alone) so hovering the close
            // button that sits on top of it doesn't count as a "leave".
            const [hovering, setHovering] = createState(false)
            function attachHoverController(self: Gtk.Overlay) {
              const motion = new Gtk.EventControllerMotion()
              motion.connect("enter", () => setHovering(true))
              motion.connect("leave", () => setHovering(false))
              self.add_controller(motion)
            }

            // iconForClass is what the button's own <image> already renders
            // with - reusing it here means a notification counts toward this
            // button exactly when it'd resolve to the same glyph, the same
            // app-identity match iconForClass is already trusted for.
            const clientIcon = iconForClass(client.class, client.pid)
            const notificationCount = notifications((list) =>
              list.filter((n) => iconForNotification(n.appName, n.desktopEntry) === clientIcon)
                .length,
            )

            // Most senders never call CloseNotification just because you read
            // their message in-app, so notifd's unresolved list only ever
            // grows on its own - see the badge's own count above. Focusing
            // the app is the closest thing to "I've seen it" this bar can
            // act on, so it dismisses this app's pending notifications the
            // same way clicking a notification itself does (Notification.tsx).
            function dismissNotifications() {
              for (const n of notifications.get()) {
                if (iconForNotification(n.appName, n.desktopEntry) === clientIcon) n.dismiss()
              }
            }

            return (
              <overlay visible={isListed} $={attachHoverController}>
                <button
                  class={buttonClass}
                  onClicked={(b) => {
                    // Dismiss either way: clicking a not-yet-focused icon
                    // means you're about to look at it, and clicking an
                    // already-active one to minimize it means you were
                    // already looking at it - both count as "seen".
                    dismissNotifications()
                    if (client.workspace?.name === MINIMIZED || b.has_css_class("active")) {
                      toggleMinimize(client)
                    } else {
                      client.focus()
                    }
                  }}
                  tooltipText={client.title}
                >
                  <image iconName={clientIcon} pixelSize={28} />
                </button>
                <box
                  $type="overlay"
                  class="notification-badge"
                  halign={Gtk.Align.START}
                  valign={Gtk.Align.START}
                  visible={notificationCount.as((c) => c > 0)}
                >
                  <label label={notificationCount.as((c) => (c > 9 ? "9+" : String(c)))} />
                </box>
                <revealer
                  $type="overlay"
                  halign={Gtk.Align.END}
                  valign={Gtk.Align.START}
                  revealChild={hovering}
                  transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                  transitionDuration={150}
                >
                  <button
                    class="close-button"
                    tooltipText="Close"
                    onClicked={() => hypr.dispatch("closewindow", `address:0x${client.address}`)}
                  >
                    <image iconName="window-close-symbolic" pixelSize={10} />
                  </button>
                </revealer>
              </overlay>
            )
          }

          // Regular workspaces on this monitor. Special workspaces
          // (scratchpads) always get negative ids in Hyprland - excluded
          // here since the minimized tray below renders separately.
          //
          // Deliberately NOT filtering on ws.clients.length here: hypr's own
          // "workspaces" list only re-notifies on structural changes (a
          // workspace being created/destroyed), not when an existing
          // workspace's client count changes. Minimizing/restoring churns
          // the special workspace (structural) a couple ms *before* the
          // target workspace's own client list actually updates, so a
          // clients.length check in this filter would race and can filter
          // a workspace out right when it should be showing back up.
          // Emptiness is handled reactively per-workspace below instead.
          const monWorkspaces = workspaces((wss) =>
            wss
              .filter((ws) => ws.id > 0 && ws.monitor?.id === m.id)
              .sort((a, b) => a.id - b.id),
          )

          // This monitor's minimized tray - 0 or 1 entries, since it's a
          // single named special workspace. Doesn't exist until the first
          // window is minimized onto it.
          const minimizedWorkspace = workspaces((wss) =>
            wss.filter((ws) => ws.name === MINIMIZED),
          )

          return (
            <box class="monitor-group" spacing={0}>
              <image class="monitor-image" iconName="video-display-symbolic" pixelSize={12} />
              <For each={monWorkspaces}>
                {(ws, index) => {
                  const clients = createBinding(ws, "clients")
                  return (
                    <box
                      class="workspace-group"
                      spacing={0}
                      // Counts only clients that survive the ignore list, so
                      // a workspace holding nothing but popups doesn't render
                      // as an empty group with a stray separator. Titles are
                      // read directly here rather than bound, so this
                      // recomputes when the client list or the ignore file
                      // changes - not on a rename.
                      visible={createComputed(() =>
                        clients().some(
                          (c) => !isIgnored(ignoreRules(), c.class, c.title),
                        ),
                      )}
                    >
                      {/* No separator on the structurally-first workspace,
                          since it sits right against the monitor icon.
                          Driven by <For>'s own reactive index rather than
                          :first-child (avoids reintroducing sibling-position
                          CSS). Known gap: this is "first workspace by id",
                          not "first workspace that's actually visible" - if
                          the lowest-id workspace on this monitor is empty
                          while a later one has windows, that later one still
                          shows a separator. */}
                      <box class="workspace-seperator" visible={index.as((i) => i > 0)} />
                      <For each={clients}>{ClientButton}</For>
                    </box>
                  )
                }}
              </For>
              <For each={minimizedWorkspace}>
                {(ws) => {
                  const clients = createBinding(ws, "clients")
                  return (
                    <box class="workspace-group minimized-tray" spacing={0}>
                      <box class="workspace-seperator" />
                      <For each={clients}>{ClientButton}</For>
                    </box>
                  )
                }}
              </For>
            </box>
          )
        }}
      </For>
    </box>
  )
}
