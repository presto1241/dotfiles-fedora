import { createState } from "ags"
import { execAsync } from "ags/process"
import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { symbolic, ICON_SIZE } from "../icons"

// This desktop has no /sys/class/backlight (external DisplayPort monitor, no
// kernel backlight interface) and the monitor's own OSD brightness is already
// floored, so hardware/DDC brightness (ddcutil) has nothing left to give.
// The only lever left is compositor-side: Hyprland's decoration:screen_shader
// takes a path to a GLSL fragment shader and runs it over every frame, so a
// shader that just multiplies the sampled colour by a constant acts as a
// software dimmer independent of the monitor entirely.
//
// hyprctl has no way to push a live uniform into an already-loaded shader,
// so there's no numeric "brightness" to read back either - `hyprctl
// getoption decoration:screen_shader` only ever returns the shader *path*.
// Changing brightness means rewriting this file with the new constant baked
// in and re-issuing the keyword, which Hyprland recompiles every time it's
// called, even when the path string is unchanged. The chosen value is
// persisted separately so it survives an ags restart.
const CACHE_DIR = `${GLib.get_user_cache_dir()}/ags`
const SHADER_PATH = `${CACHE_DIR}/brightness.frag`
const STATE_PATH = `${CACHE_DIR}/brightness`

// Without the knob (see the CSS in scss/_bar.scss, which shrinks the scale's
// "slider" node to nothing) the only way left to set a value is clicking
// straight on the trough. GTK supports that natively, but whether a primary
// click there jumps straight to that position or just pages one step towards
// it is a GtkSettings toggle, not per-widget - force it on here so the
// behaviour doesn't depend on whatever the desktop happens to have it set to.
Gtk.Settings.get_default()!.gtkPrimaryButtonWarpsSlider = true

function shaderSource(brightness: number) {
  // Hyprland links this against its own internal vertex shader, and 0.56.x's
  // is GLSL ES 3.00 - linking fails ("all shaders must use same shading
  // language version") if this one declares #version 100/#version 100 es
  // instead. ES 3.00 also drops `varying`/`texture2D`/`gl_FragColor` in
  // favour of `in`/`texture`/an explicit `out` var.
  return `#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
out vec4 fragColor;

void main() {
    vec4 pixColor = texture(tex, v_texcoord);
    fragColor = vec4(pixColor.rgb * ${brightness.toFixed(3)}, pixColor.a);
}
`
}

function readSavedBrightness(): number {
  try {
    const [, contents] = GLib.file_get_contents(STATE_PATH)
    const value = Number(new TextDecoder().decode(contents).trim())
    return value > 0 && value <= 1 ? value : 1
  } catch {
    return 1
  }
}

function applyBrightness(value: number) {
  GLib.mkdir_with_parents(CACHE_DIR, 0o755)
  GLib.file_set_contents(STATE_PATH, value.toFixed(3))

  if (value >= 1) {
    // Full brightness - disable the shader rather than run a no-op
    // multiply-by-1 pass over every frame.
    execAsync(["hyprctl", "keyword", "decoration:screen_shader", ""]).catch(console.error)
    return
  }

  GLib.file_set_contents(SHADER_PATH, shaderSource(value))
  execAsync(["hyprctl", "keyword", "decoration:screen_shader", SHADER_PATH]).catch(console.error)
}

export default function MonitorBrightness() {
  const initial = readSavedBrightness()
  applyBrightness(initial)

  // Setting `value` reactively from the same handler that "value-changed"
  // drives would mean every drag frame writes the slider's value right back
  // to itself while GTK's own drag gesture is mid-update - set it once at
  // construction via $ instead, and let GTK own it after that.
  let debounceId = 0

  function onValueChanged(slider: Astal.Slider) {
    const value = slider.value

    // A drag fires this on every pointer-motion tick; recompiling the
    // shader and shelling out to hyprctl on each one is wasteful and can
    // make the drag feel like it's fighting the UI. Coalesce to the value
    // that's still current 80ms after motion stops.
    if (debounceId) GLib.source_remove(debounceId)
    debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
      debounceId = 0
      applyBrightness(value)
      return GLib.SOURCE_REMOVE
    })
  }

  // GtkWidget has no hover signal of its own in GTK4 - enter/leave only
  // exist on an explicit event controller, so one has to be attached by
  // hand via $ rather than an onSomething JSX prop.
  const [hovering, setHovering] = createState(false)

  function attachHoverController(self: Gtk.Box) {
    const motion = new Gtk.EventControllerMotion()
    motion.connect("enter", () => setHovering(true))
    motion.connect("leave", () => setHovering(false))
    self.add_controller(motion)
  }

  return (
    <box $={attachHoverController} spacing={4}>
      <image marginStart={4} paintable={symbolic("display-brightness-symbolic")} pixelSize={ICON_SIZE} />

      <revealer
        revealChild={hovering}
        transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
        transitionDuration={200}
      >
        {/* hexpand/halign=FILL here was the wrong lever - GTK propagates a
            descendant's hexpand up through every ancestor container that
            doesn't explicitly override it (that's how "give leftover space
            to whoever wants it" gets decided), so it was reaching all the
            way up to the bar's own end-of-bar box and centerbox, making the
            *whole bar* request extra width even while the revealer sat
            collapsed. widthRequest sets a fixed natural size directly
            instead, with no expand semantics to leak upward. */}
        <slider
          class="brightness-slider"
          widthRequest={100}
          min={0.2}
          max={1}
          value={initial}
          onValueChanged={onValueChanged}
        />
      </revealer>
    </box>
  )
}
