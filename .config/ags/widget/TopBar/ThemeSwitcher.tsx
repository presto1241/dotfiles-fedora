import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { symbolic, ICON_SIZE } from "../icons"
import { createState } from "ags"

const THEMES_DIR = `${GLib.get_user_config_dir()}/themes`
const APPLY_SCRIPT = `${THEMES_DIR}/apply.sh`

// GLib.Dir only lists names - it doesn't say what they are, so each entry
// needs its own file_test. IS_DIR follows symlinks (stat, not lstat), which
// would let "current" (a symlink to whichever pack is active) through as if
// it were its own theme; IS_SYMLINK excludes it, matching apply.sh --list's
// `find -type d` which never follows symlinks either.
function listThemes(): string[] {
  const dir = GLib.Dir.open(THEMES_DIR, 0)
  const names: string[] = []
  let name: string | null
  while ((name = dir.read_name()) !== null) {
    if (name === "lib") continue
    const path = `${THEMES_DIR}/${name}`
    if (GLib.file_test(path, GLib.FileTest.IS_DIR) && !GLib.file_test(path, GLib.FileTest.IS_SYMLINK)) {
      names.push(name)
    }
  }
  return names.sort()
}


export default function ThemeSwitcher() {
  // Themes are folders on disk that don't change while the bar is running,
  // so this only needs to run once at mount - no reactive state involved.
  const themes = listThemes()
  const [applyBackground, setApplyBackground] = createState(true);

  return (
    <menubutton>
      <image
        paintable={symbolic("preferences-desktop-appearance-symbolic")}
        pixelSize={ICON_SIZE}
        class={"theme-switcher-icon"}
      />
      <popover hasArrow={false}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          {themes.map((name) => (
            <button onClicked={() => execAsync([APPLY_SCRIPT, name, applyBackground.peek() ? "" : "--no-switch-wallpaper"])}>
              <label label={name} />
            </button>
          ))}

          <box orientation={Gtk.Orientation.HORIZONTAL}>
            <togglebutton
              active={applyBackground}
              onToggled={() => setApplyBackground((b) => !b)}
            >
              <box>
                <label label={applyBackground.as(active => active ? "✔" : " ")}/>
                <label label="Inherit Wallpaper"/>
              </box>
            </togglebutton>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
