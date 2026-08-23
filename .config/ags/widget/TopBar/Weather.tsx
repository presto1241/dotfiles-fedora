import { createPoll } from "ags/time"
import fetch from "ags/fetch"
import { symbolic, ICON_SIZE } from "../icons"

// TODO: set these to your location. Open-Meteo has no geolocation/IP lookup
// built in, and a bar should show weather for where you live, not wherever
// the laptop currently is - grab lat/lon from openstreetmap.org or Google Maps.
const LAT = 47.708817025354676
const LON = -122.08939976360895
const UNIT: "fahrenheit" | "celsius" = "celsius"

const REFRESH_MS = 15 * 60 * 1000

type Weather = {
  temp: number
  code: number
  day: boolean
} | null

// Open-Meteo reports WMO weather codes - this collapses the full table
// (https://open-meteo.com/en/docs) down to the icon/label granularity a bar
// widget actually needs. Icon names are the base name; conditions where the
// sun is part of the drawing get a "-night" variant swapped in after dark.
const CONDITIONS: Record<number, { icon: string; label: string; nocturnal?: true }> = {
  0: { icon: "weather-clear", label: "Clear", nocturnal: true },
  1: { icon: "weather-few-clouds", label: "Mostly Clear", nocturnal: true },
  2: { icon: "weather-few-clouds", label: "Partly Cloudy", nocturnal: true },
  3: { icon: "weather-overcast", label: "Overcast" },
  45: { icon: "weather-fog", label: "Fog" },
  48: { icon: "weather-fog", label: "Fog" },
  51: { icon: "weather-showers-scattered", label: "Light Drizzle" },
  53: { icon: "weather-showers-scattered", label: "Drizzle" },
  55: { icon: "weather-showers", label: "Heavy Drizzle" },
  61: { icon: "weather-showers-scattered", label: "Light Rain" },
  63: { icon: "weather-showers", label: "Rain" },
  65: { icon: "weather-showers", label: "Heavy Rain" },
  71: { icon: "weather-snow", label: "Light Snow" },
  73: { icon: "weather-snow", label: "Snow" },
  75: { icon: "weather-snow", label: "Heavy Snow" },
  80: { icon: "weather-showers-scattered", label: "Rain Showers" },
  95: { icon: "weather-storm", label: "Thunderstorm" },
}

function weatherUnit()
{
  return UNIT == "fahrenheit" ? "f" : "c";
}

function conditionFor(code: number) {
  return CONDITIONS[code] ?? { icon: "weather-severe-alert", label: "Unknown" }
}

function iconFor(w: Weather) {
  const condition = conditionFor(w?.code ?? -1)
  const night = w !== null && !w.day && condition.nocturnal

  return symbolic(`${condition.icon}${night ? "-night" : ""}-symbolic`)
}

export default function Weather() {
  const weather = createPoll<Weather>(null, REFRESH_MS, async (prev) => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${LAT}&longitude=${LON}` +
        `&current=temperature_2m,weather_code,is_day&temperature_unit=${UNIT}`

      const res = await fetch(url)
      const data = await res.json()

      return {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code,
        day: data.current.is_day === 1,
      }
    } catch {
      // Network blip or API hiccup - keep showing the last good reading
      // instead of blanking out for a cycle.
      return prev
    }
  })

  return (
    <box class="weather" spacing={0}>
      <image
        paintable={weather.as(iconFor)}
        pixelSize={ICON_SIZE}
        tooltipText={weather.as((w) => conditionFor(w?.code ?? -1).label)}
      />
      <label label={weather.as((w) => (w ? `${w.temp}${weatherUnit()}` : `--${weatherUnit()}`))} />
    </box>
  )
}
