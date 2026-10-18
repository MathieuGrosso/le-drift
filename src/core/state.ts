import { DRIFT_ROUTE, DRIFT_Y } from './layout'
import { TIME } from './tuning'
import type { DayPhase, GameState, QualityLevel } from './types'

export function createInitialState(quality: QualityLevel = 'high'): GameState {
  const start = DRIFT_ROUTE[0]!
  return {
    version: 2,
    mode: 'inside',
    act: 1,
    quests: {},
    flags: {},
    time: { hours: TIME.startHour, day: TIME.startDay, scale: 1 / TIME.realSecondsPerGameHour },
    env: { current: { x: 0, y: 0, z: -0.3 }, visibility: 30, bloom: 0, jellyfish: 0.3, rain: 0 },
    hero: {
      position: { x: start.x, y: DRIFT_Y, z: start.z },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      mode: 'idle',
      breath: 1,
      breathMax: 1,
      exhausted: false,
      lastSafe: { x: start.x, y: DRIFT_Y, z: start.z },
      medium: 'air',
      room: 'cabine',
      wetness: 0,
      localPosition: { x: -7, y: 0, z: 65.4 },
      district: 'ecluse',
      sortie: null,
    },
    drift: {
      progress: 0,
      position: { x: start.x, y: DRIFT_Y, z: start.z },
      heading: 0,
      velocity: { x: 0, y: 0, z: 0 },
      gate: 'halte-prairie',
      altitude: DRIFT_Y,
      doors: {},
    },
    chart: { sondes: [], reperes: [], pins: [] },
    inventory: { items: { frottoir: 1, longe: 1 }, slots: 20 },
    shallows: [],
    trouvailles: [],
    windows: {},
    settings: { quality, invertY: false, sensitivity: 1, volume: 0.8, minimap: true },
    debug: { cameraLocked: false },
  }
}

export function phaseAt(hours: number): DayPhase {
  const h = ((hours % 24) + 24) % 24
  const p = TIME.phases
  if (h >= p.aube && h < p.jour) return 'aube'
  if (h >= p.jour && h < p.crepuscule) return 'jour'
  if (h >= p.crepuscule && h < p.nuit) return 'crepuscule'
  return 'nuit'
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return (patch === undefined ? base : (patch as T))
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    const b = (base as Record<string, unknown>)[k]
    out[k] = isObject(b) && isObject(v) ? deepMerge(b, v) : v
  }
  return out as T
}

export function migrateState(raw: unknown, quality: QualityLevel): GameState | null {
  if (!isObject(raw) || typeof raw.version !== 'number') return null
  if (raw.version !== 2) return null
  return deepMerge(createInitialState(quality), raw)
}
