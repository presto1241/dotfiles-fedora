import { createState } from "ags"
import { readFile, monitorFile } from "ags/file"
import GLib from "gi://GLib"

// Newline-delimited list of windows to keep out of the dock.
// See the file itself for the format.
const CONFIG_PATH = `${GLib.get_user_config_dir()}/ags/ignored-windows.conf`

export type IgnoreRule = {
  field: "title" | "class"
  pattern: RegExp
}

// Globs are deliberately not full regexes - the file is meant to hold
// window names copied straight out of `hyprctl clients`, and those are
// full of dots (UnityEditor.IconSelector) that would silently behave as
// regex wildcards. So everything is escaped and only "*" is given back
// its wildcard meaning.
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.split("\\*").join(".*")}$`)
}

function parse(text: string): IgnoreRule[] {
  const rules: IgnoreRule[] = []

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    // Only a leading # is a comment, so a "#" inside a window title
    // stays part of the pattern.
    if (!line || line.startsWith("#")) continue

    const prefixed = /^(class|title):(.*)$/.exec(line)
    if (prefixed) {
      rules.push({
        field: prefixed[1] as "title" | "class",
        pattern: globToRegExp(prefixed[2].trim()),
      })
    } else {
      rules.push({ field: "title", pattern: globToRegExp(line) })
    }
  }

  return rules
}

function load(): IgnoreRule[] {
  try {
    return parse(readFile(CONFIG_PATH))
  } catch {
    // Missing or unreadable file just means "ignore nothing".
    return []
  }
}

const [ignoreRules, setIgnoreRules] = createState(load())

// Re-read on save. monitorFile re-arms itself if the file is replaced
// rather than edited in place, which is what most editors do.
monitorFile(CONFIG_PATH, () => setIgnoreRules(load()))

export { ignoreRules }

export function isIgnored(
  rules: IgnoreRule[],
  cls: string | null,
  title: string | null,
): boolean {
  return rules.some((rule) =>
    rule.pattern.test((rule.field === "class" ? cls : title) ?? ""),
  )
}
