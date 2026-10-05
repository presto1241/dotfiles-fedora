import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState } from "ags"
import { timeout } from "ags/time"
import { SECONDARY_STRIP_AUTOHIDE, SECONDARY_STRIP_HIDE_DELAY_MS } from "../../config"
import WorkspaceStrip from "./WorkspaceStrip"

// Top-centre workspace strip for the non-primary monitors. Floats over
// content (no reserved space), and with auto-hide on it collapses down to a
// thin hot-zone at the screen edge - a layer surface can't be zero-sized
// and still catch the pointer, so that sliver is what you hover to bring the
// strip back. Sized in scss (.strip-hotzone) - it also has to give the window
// a width of its own, since a collapsed revealer reports none.
export default function StripBar(gdkmonitor: Gdk.Monitor) {
  const { TOP } = Astal.WindowAnchor
  const [revealed, setRevealed] = createState(!SECONDARY_STRIP_AUTOHIDE)

  let hideTimer: { cancel(): void } | null = null
  let pointerInside = false
  let previewOpen = false

  function cancelHide() {
    hideTimer?.cancel()
    hideTimer = null
  }

  // Small grace period so skimming off the edge of the strip doesn't snap it
  // shut mid-reach. Stays put while the pointer is over the strip or one of
  // its hover-preview popovers (which are their own surfaces, so moving onto
  // one reads as leaving the window).
  function scheduleHide() {
    cancelHide()
    if (!SECONDARY_STRIP_AUTOHIDE || pointerInside || previewOpen) return
    hideTimer = timeout(SECONDARY_STRIP_HIDE_DELAY_MS, () => {
      hideTimer = null
      if (pointerInside || previewOpen) return
      setRevealed(false)
    })
  }

  function attachHoverController(self: Gtk.Box) {
    if (!SECONDARY_STRIP_AUTOHIDE) return

    const motion = new Gtk.EventControllerMotion()
    motion.connect("enter", () => {
      pointerInside = true
      cancelHide()
      setRevealed(true)
    })
    motion.connect("leave", () => {
      pointerInside = false
      scheduleHide()
    })
    self.add_controller(motion)
  }

  function onPreviewChange(open: boolean) {
    previewOpen = open
    if (open) cancelHide()
    else scheduleHide()
  }

  return (
    <window
      visible
      name={`workspace-strip-${gdkmonitor.connector}`}
      class="Bar StripBar"
      namespace="workspace-strip"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP}
      application={app}
      defaultWidth={1}
      defaultHeight={1}
    >
      <box orientation={Gtk.Orientation.VERTICAL} $={attachHoverController}>
        <box class="strip-hotzone" visible={SECONDARY_STRIP_AUTOHIDE} />
        <revealer
          halign={Gtk.Align.CENTER}
          revealChild={revealed}
          transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
          transitionDuration={200}
        >
          <WorkspaceStrip gdkmonitor={gdkmonitor} onPreviewChange={onPreviewChange} />
        </revealer>
      </box>
    </window>
  )
}
