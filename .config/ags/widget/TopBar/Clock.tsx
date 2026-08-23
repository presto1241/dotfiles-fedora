import { createPoll } from "ags/time"
import fetch from "ags/fetch"
import { Gtk } from "ags/gtk4"

const time = createPoll("", 1000, 'date "+%H:%M %a %b %-d"')

export default function Clock() {
  return (
    <menubutton>
      <label label={time} />
      <popover hasArrow={false}>
        <Gtk.Calendar />
      </popover>
    </menubutton>
  )
}
