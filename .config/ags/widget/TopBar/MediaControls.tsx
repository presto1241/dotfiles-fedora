import AstalMpris from "gi://AstalMpris?version=0.1"
import AstalApps from "gi://AstalApps?version=0.1"
import { Gtk } from "ags/gtk4"
import { createBinding } from "ags";

export default function MediaControls() {
  const mpris = AstalMpris.get_default();
  const apps = new AstalApps.Apps();
  const players = createBinding(mpris, "players");

  return (
    <box>
      <button class="media-control"
        onClicked={() => mpris.get_players()[0]?.previous()}
      >
        <image iconName="media-skip-backward" pixelSize={14}/>
      </button>

      <button
        class="media-control"
        onClicked={() => mpris.get_players()[0]?.play_pause()}
      >
        <image iconName={mpris.get_players()[0]?.playbackStatus === AstalMpris.PlaybackStatus.PLAYING ? "media-playback-pause" : "media-playback-start"} pixelSize={14}/>
      </button>

      <button class="media-control"
        onClicked={() => mpris.get_players()[0]?.next()}
      >
        <image iconName="media-skip-forward" pixelSize={14}/>
      </button>
    </box>
  )
}
