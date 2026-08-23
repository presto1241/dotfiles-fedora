import { Gtk } from "ags/gtk4"
import { createBinding, For } from "ags"
import GLib from "gi://GLib"
import Pango from "gi://Pango"
import Notifd from "gi://AstalNotifd?version=0.1"

// The spec lets senders pick an urgency, and CRITICAL notifications are the
// ones that must not auto-dismiss (see NotificationPopups). Everything here
// just maps that onto a CSS class so scss/_notifications.scss can colour the
// accent stripe.
function urgencyClass(urgency: Notifd.Urgency) {
  switch (urgency) {
    case Notifd.Urgency.CRITICAL:
      return "critical"
    case Notifd.Urgency.LOW:
      return "low"
    default:
      return "normal"
  }
}

// The spec calls the body a small markup subset (<b>, <i>, <a>), but plenty of
// senders emit something Pango won't take - bwrap's crash handler wraps its
// message in <html>, and anything with a bare "&" or "<" in prose fails too.
// Pango's response is to refuse the whole label, so an unvalidated useMarkup
// silently renders those notifications blank. Check first and drop back to
// plain text, which is what the text wanted to be in those cases anyway.
function isValidMarkup(text: string) {
  if (text === "") return false
  try {
    Pango.parse_markup(text, -1, "\0")
    return true
  } catch {
    return false
  }
}

// `time` is unix seconds. Notifications are short-lived so the useful format
// is a clock time, not a relative "2 minutes ago" that would need a ticker.
function formatTime(unix: number) {
  const dt = GLib.DateTime.new_from_unix_local(unix)
  return dt ? dt.format("%H:%M") ?? "" : ""
}

export default function Notification(n: Notifd.Notification) {
  // Bound rather than read once: a sender that reuses an id (replaces_id in
  // the spec - progress bars, "downloading..." -> "done") mutates this same
  // object in place instead of sending a fresh one.
  const summary = createBinding(n, "summary")
  const body = createBinding(n, "body")

  // Two different icon sources in the spec: `image` is a path to a picture
  // that belongs to this specific notification (album art, an avatar), while
  // `appIcon` identifies the sending app. Prefer the former, fall back to the
  // latter, and fall back again to a generic bell so the header never has a
  // blank gap where an icon should be.
  const hasImage = n.image !== null && n.image !== ""
  const appIcon = n.appIcon !== null && n.appIcon !== "" ? n.appIcon : "dialog-information-symbolic"

  return (
    <box
      class={`notification ${urgencyClass(n.urgency)}`}
      orientation={Gtk.Orientation.VERTICAL}
    >
      <box class="header" spacing={6}>
        <image iconName={appIcon} pixelSize={16} />
        <label class="app-name" label={n.appName || "Notification"} />
        <label
          class="time"
          label={formatTime(n.time)}
          hexpand
          halign={Gtk.Align.END}
        />
        <button class="close" onClicked={() => n.dismiss()}>
          <image iconName="window-close-symbolic" pixelSize={12} />
        </button>
      </box>
      <box class="content" spacing={10}>
        <image
          visible={hasImage}
          file={hasImage ? n.image : null}
          pixelSize={48}
          valign={Gtk.Align.START}
          overflow={Gtk.Overflow.HIDDEN}
        />
        <box orientation={Gtk.Orientation.VERTICAL} hexpand>
          <label
            class="summary"
            label={summary}
            xalign={0}
            wrap
            wrapMode={Gtk.WrapMode.WORD_CHAR}
            maxWidthChars={30}
          />
          <label
            class="body"
            label={body}
            xalign={0}
            wrap
            wrapMode={Gtk.WrapMode.WORD_CHAR}
            maxWidthChars={30}
            useMarkup={body.as(isValidMarkup)}
            visible={body.as((b) => b !== "")}
          />
        </box>
      </box>

      <box class="actions" spacing={6} visible={n.actions.length > 0} homogeneous>
        <For each={createBinding(n, "actions")}>
          {(action: Notifd.Action) => (
            <button onClicked={() => n.invoke(action.id)}>
              <label label={action.label} />
            </button>
          )}
        </For>
      </box>
    </box>
  )
}
