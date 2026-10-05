import { createBinding, createComputed, createState, For, onCleanup } from "ags"
import { Gdk, Gtk } from "ags/gtk4"
import { timeout } from "ags/time"
import Hyprland from "gi://AstalHyprland"
import { ignoreRules, isIgnored } from "../../ignoredWindows"
import { ClientButton, minimizedWorkspaceName } from "./ClientButton"

// Smaller than the bottom dock's 28 so the strip fits the top bar's height.
const ICON_SIZE = 16

// How long a preview lingers after the pointer leaves, so you can cross the
// gap from the number to the popover and click something in it.
const PREVIEW_CLOSE_DELAY_MS = 250

// One monitor's workspaces as "1 2 (3) 4 | [minimized] | [icons of the current
// workspace]". The numbers are fixed-width, so switching workspace only ever
// changes the far-right icon section, which keeps the rest of the bar still.
// Hovering a number previews that workspace's apps in a popover. Numbers are
// the workspace's position among this monitor's own workspaces (matching
// Super+Left/Right cycling), not the global Hyprland id.
//
// onPreviewChange lets a host that auto-hides (StripBar) know a popover is
// open, since the pointer leaving its window for the popover isn't "leaving".
export default function WorkspaceStrip({
  gdkmonitor,
  onPreviewChange,
}: {
  gdkmonitor: Gdk.Monitor
  onPreviewChange?: (open: boolean) => void
}) {
  const hypr = Hyprland.get_default()
  const name = gdkmonitor.connector ?? ""
  const monitor = hypr.monitors.find((m) => m.name === name)
  if (!monitor) return <box />

  const workspaces = createBinding(hypr, "workspaces")
  const activeWorkspace = createBinding(monitor, "activeWorkspace")
  const MINIMIZED = minimizedWorkspaceName(name)

  // Not filtered on ws.clients.length - see the note in Workspaces.tsx
  // about why: emptiness is handled reactively per workspace below.
  const monWorkspaces = workspaces((wss) =>
    wss.filter((ws) => ws.id > 0 && ws.monitor?.name === name).sort((a, b) => a.id - b.id),
  )
  const minimizedWorkspace = workspaces((wss) => wss.filter((ws) => ws.name === MINIMIZED))

  // Shared by the number and the icon section, which both need to know if a
  // workspace is the current one and whether it holds anything worth listing.
  function workspaceState(ws: Hyprland.Workspace) {
    const clients = createBinding(ws, "clients")
    const isActive = activeWorkspace.as((a) => a?.id === ws.id)
    const hasWindows = createComputed(() =>
      clients().some((c) => !isIgnored(ignoreRules(), c.class, c.title)),
    )
    return { clients, isActive, hasWindows }
  }

  const [tasksOpen, setTasksOpen] = createState(false)

  return (
    <box class="workspace-strip widget-group" spacing={0}>
      {/* Wrapped in its own box: gnim's <For> re-appends every tracked
          child to the end of its real parent on any list change (see
          node_modules/gnim/dist/jsx/For.ts), which would otherwise shove
          these past the toggle button/revealer below on every workspace
          add/remove. A dedicated wrapper contains that churn to one stable
          slot instead of sharing the outer box's children list. */}
      <box>
        <For each={monWorkspaces}>
          {(ws, index) => {
          const { clients, isActive, hasWindows } = workspaceState(ws)

          // The popover is parented by hand: a plain GtkButton has no slot for
          // one (only GtkMenuButton does, and that would also grab the click).
          // It never grabs input (autohide off) so the pointer can move
          // between the number and the popover freely, and it's only ever
          // shown for a workspace you're not already looking at.
          const preview = new Gtk.Popover({
            autohide: false,
            hasArrow: false,
            position: Gtk.PositionType.BOTTOM,
          })
          preview.add_css_class("workspace-preview")
          preview.set_child(
            (
              <box>
                <For each={clients}>{(c) => ClientButton(c, name, ICON_SIZE)}</For>
              </box>
            ) as Gtk.Widget,
          )
          onCleanup(() => {
            preview.popdown()
            preview.unparent()
          })

          let overNumber = false
          let overPreview = false
          let previewOpen = false
          let closeTimer: { cancel(): void } | null = null

          function setPreview(open: boolean) {
            if (open === previewOpen) return
            previewOpen = open
            if (open) preview.popup()
            else preview.popdown()
            onPreviewChange?.(open)
          }

          // Re-evaluated on every enter/leave of either the number or the
          // popover: open at once while hovered, close after a short grace.
          function updatePreview() {
            closeTimer?.cancel()
            closeTimer = null
            if (overNumber || overPreview) {
              if (isActive.get() || !hasWindows.get()) return
              setPreview(true)
              return
            }
            closeTimer = timeout(PREVIEW_CLOSE_DELAY_MS, () => {
              closeTimer = null
              setPreview(false)
            })
          }

          function hoverController(onChange: (over: boolean) => void) {
            const motion = new Gtk.EventControllerMotion()
            motion.connect("enter", () => {
              onChange(true)
              updatePreview()
            })
            motion.connect("leave", () => {
              onChange(false)
              updatePreview()
            })
            return motion
          }
          preview.add_controller(hoverController((over) => (overPreview = over)))

          function attachNumber(self: Gtk.Button) {
            preview.set_parent(self)
            self.add_controller(hoverController((over) => (overNumber = over)))
          }

          return (
            // AspectFrame keeps each number 1:1 from the allocated height;
            // GTK CSS has no aspect-ratio, and min-width/min-height alone
            // can't follow the bar's height.
            <Gtk.AspectFrame
              ratio={1}
              obeyChild={false}
              valign={Gtk.Align.FILL}
              // The workspace you're on always shows, even empty. Others
              // only when they hold something worth listing.
              visible={createComputed(() => isActive() || hasWindows())}
            >
              <button
                class={isActive.as((a) => (a ? "workspace-number active" : "workspace-number"))}
                $={attachNumber}
                onClicked={() => {
                  setPreview(false)
                  ws.focus()
                }}
              >
                <label label={index.as((i) => String(i + 1))} />
              </button>
            </Gtk.AspectFrame>
          )
        }}
        </For>
      </box>

      <button
        // "open", not "active" - .workspace-strip already has a
        // button.active image rule for ClientButton's focused-window glow,
        // and reusing that name here made the toggle pick it up too.
        class={tasksOpen.as((v) => (v ? "tasks-toggle open" : "tasks-toggle"))}
        onClicked={() => setTasksOpen((v) => !v)}
      >
        <image iconName="go-next" pixelSize={12} />
      </button>

      {/* Individual and minimized app icons live behind this toggle rather
          than always on, same idea as the tray's own expand arrow
          (SystemTray.tsx) - the numbers above are the always-visible
          taskbar, this is the overflow. */}
      <revealer
        revealChild={tasksOpen}
        transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
        transitionDuration={200}
      >
        <box>
          {/* Own wrapper box, same reason as the numbers above: this and
              the active-apps <For> below are siblings, and either one
              re-appending on its own list change would otherwise jump
              past the other. */}
          <box>
            <For each={minimizedWorkspace}>
              {(ws) => {
                const clients = createBinding(ws, "clients")
                return (
                  <box class="minimized-tray">
                    <box class="workspace-seperator" />
                    <For each={clients}>{(c) => ClientButton(c, name, ICON_SIZE)}</For>
                  </box>
                )
              }}
            </For>
          </box>

          {/* The current workspace's apps, last so that the section that
              changes size on every workspace switch is the one on the far
              right. One group per workspace with only the active one
              showing, which keeps each group bound to its own workspace's
              client list. */}
          <box>
            <For each={monWorkspaces}>
              {(ws) => {
                const { clients, isActive, hasWindows } = workspaceState(ws)
                return (
                  <box
                    class="active-apps"
                    visible={createComputed(() => isActive() && hasWindows())}
                  >
                    <box class="workspace-seperator" />
                    <For each={clients}>{(c) => ClientButton(c, name, ICON_SIZE)}</For>
                  </box>
                )
              }}
            </For>
          </box>
        </box>
      </revealer>
    </box>
  )
}
