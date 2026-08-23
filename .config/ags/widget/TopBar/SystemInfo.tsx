import { createPoll } from "ags/time"
import { createState, createComputed } from "ags"
import GLib from "gi://GLib"

const REFRESH_MS = 2000

// Specific to this machine's AMD GPU (Navi 32, amdgpu driver) - the sysfs
// path and file both depend on the card index and driver; an Nvidia system
// would need `nvidia-smi` instead.
const GPU_BUSY_PATH = "/sys/class/drm/card1/device/gpu_busy_percent"

// hwmonN directory numbering isn't stable - it's assigned in whatever order
// hwmon-registering drivers happen to load in, which can shift across boots
// or kernel updates. Resolve by driver name once at module load instead of
// hardcoding an index. The temp*_input index *within* a driver's directory
// is stable though (it's fixed in that driver's kernel source), so those
// stay hardcoded below.
function hwmonPath(driverName: string): string | null {
  const base = "/sys/class/hwmon"
  const dir = GLib.Dir.open(base, 0)
  let name: string | null
  while ((name = dir.read_name()) !== null) {
    try {
      const [, contents] = GLib.file_get_contents(`${base}/${name}/name`)
      if (new TextDecoder().decode(contents).trim() === driverName) {
        return `${base}/${name}`
      }
    } catch {
      continue
    }
  }
  return null
}

const CPU_HWMON = hwmonPath("k10temp")
const GPU_HWMON = hwmonPath("amdgpu")

function readTempC(path: string | null): number {
  if (!path) return 0
  try {
    const [, contents] = GLib.file_get_contents(path)
    // hwmon temp*_input files report millidegrees C.
    return Math.round(Number(new TextDecoder().decode(contents).trim()) / 1000)
  } catch {
    return 0
  }
}

function readCpuStat() {
  const [, contents] = GLib.file_get_contents("/proc/stat")
  // First line only - the "cpu " aggregate across all cores. Fields are
  // cumulative ticks since boot: user nice system idle iowait irq softirq
  // steal guest guest_nice - a single read is meaningless on its own, usage%
  // only comes from the delta between two reads.
  const line = new TextDecoder().decode(contents).split("\n")[0]
  const fields = line.trim().split(/\s+/).slice(1).map(Number)

  const idle = fields[3] + fields[4] // idle + iowait
  const total = fields.reduce((sum, n) => sum + n, 0)

  return { idle, total }
}

// Seeded at module load so the very first poll tick already has a real
// baseline to diff against, instead of comparing against zero and reporting
// ~100% for one frame.
let prevCpu = readCpuStat()

function cpuUsage(): number {
  const curr = readCpuStat()
  const idleDelta = curr.idle - prevCpu.idle
  const totalDelta = curr.total - prevCpu.total
  prevCpu = curr

  return totalDelta > 0 ? Math.round(100 * (1 - idleDelta / totalDelta)) : 0
}

function ramUsage(): number {
  const [, contents] = GLib.file_get_contents("/proc/meminfo")
  const text = new TextDecoder().decode(contents)

  // Values are in kB. MemAvailable (not MemFree) reflects memory actually
  // usable by new processes without swapping - it already accounts for
  // reclaimable cache/buffers the way MemFree doesn't, so MemFree alone
  // would read as "almost full" even on an idle system.
  const total = Number(text.match(/^MemTotal:\s+(\d+)/m)?.[1] ?? 0)
  const available = Number(text.match(/^MemAvailable:\s+(\d+)/m)?.[1] ?? 0)

  return total > 0 ? Math.round(100 * (1 - available / total)) : 0
}

function gpuUsage(): number {
  try {
    const [, contents] = GLib.file_get_contents(GPU_BUSY_PATH)
    return Number(new TextDecoder().decode(contents).trim())
  } catch {
    // amdgpu didn't expose this file on some older driver versions.
    return 0
  }
}

type Stats = { cpu: number; cpuTemp: number; gpu: number; gpuTemp: number; ram: number }

export default function SystemInfo() {
  const stats = createPoll<Stats>(
    { cpu: 0, cpuTemp: 0, gpu: 0, gpuTemp: 0, ram: 0 },
    REFRESH_MS,
    () => ({
      cpu: cpuUsage(),
      cpuTemp: readTempC(CPU_HWMON && `${CPU_HWMON}/temp1_input`), // Tctl
      gpu: gpuUsage(),
      gpuTemp: readTempC(GPU_HWMON && `${GPU_HWMON}/temp2_input`), // junction
      ram: ramUsage(),
    }),
  )

  const [cpuShowTemp, setCpuShowTemp] = createState(false)
  const [gpuShowTemp, setGpuShowTemp] = createState(false)

  const cpuLabel = createComputed(() =>
    cpuShowTemp() ? `CPU ${stats().cpuTemp}c` : `CPU ${stats().cpu}%`,
  )
  const gpuLabel = createComputed(() =>
    gpuShowTemp() ? `GPU ${stats().gpuTemp}c` : `GPU ${stats().gpu}%`,
  )

  return (
    <box class="system-info" spacing={0}>
      <button onClicked={() => setCpuShowTemp((v) => !v)}>
        <label label={cpuLabel} />
      </button>
      <button onClicked={() => setGpuShowTemp((v) => !v)}>
        <label label={gpuLabel} />
      </button>
      <label label={stats.as((s) => `RAM ${s.ram}%`)} />
    </box>
  )
}
