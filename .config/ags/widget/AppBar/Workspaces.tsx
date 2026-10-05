import { createBinding, createComputed, For } from "ags"
import { Gdk } from "ags/gtk4"
import Hyprland from "gi://AstalHyprland"
import { ignoreRules, isIgnored } from "../../ignoredWindows"
import { ClientButton, minimizedWorkspaceName } from "./ClientButton"

export default function Workspaces({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  const hypr = Hyprland.get_default()
  const workspaces = createBinding(hypr, "workspaces")
  const monitors = createBinding(hypr, "monitors")

  const sortedMonitors = monitors((m) =>
    m.sort((a, b) => a.id - b.id)
  )

  return (
    <box spacing={4}>
      <For each={sortedMonitors}>
        {(m) => {
          const MINIMIZED = minimizedWorkspaceName(m.name)

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
                      <For each={clients}>{(c) => ClientButton(c, m.name)}</For>
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
                      <For each={clients}>{(c) => ClientButton(c, m.name)}</For>
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
