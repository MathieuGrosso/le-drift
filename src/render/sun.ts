import * as THREE from 'three'
import { TIME } from '../core/tuning'
import type { DayPhase } from '../core/types'
import { PALETTE } from './palette'

const DEG = Math.PI / 180
const SUNRISE = TIME.phases.aube
const SUNSET = TIME.phases.nuit
const MIN_WATER_ELEVATION = 25 * DEG
const PEAK_ELEVATION = 70 * DEG

export interface SunState {
  airDir: THREE.Vector3
  waterDir: THREE.Vector3
  color: THREE.Color
  intensity: number
  day: number
  night: number
  warm: number
}

const cAube = new THREE.Color(PALETTE.soleilAube)
const cJour = new THREE.Color(PALETTE.soleilJour)
const cSoir = new THREE.Color(PALETTE.soleilSoir)
const cLune = new THREE.Color(PALETTE.lune)
const tmp = new THREE.Color()

export function phaseAt(hours: number): DayPhase {
  const h = ((hours % 24) + 24) % 24
  const p = TIME.phases
  if (h >= p.aube && h < p.jour) return 'aube'
  if (h >= p.jour && h < p.crepuscule) return 'jour'
  if (h >= p.crepuscule && h < p.nuit) return 'crepuscule'
  return 'nuit'
}

function dirFrom(t: number, elevation: number, out: THREE.Vector3): THREE.Vector3 {
  const az = Math.PI * t
  const ce = Math.cos(elevation)
  return out.set(Math.cos(az) * ce, Math.sin(elevation), Math.sin(az) * 0.65 * ce).normalize()
}

export function computeSun(hours: number, out: SunState): SunState {
  const h = ((hours % 24) + 24) % 24
  const up = h >= SUNRISE && h <= SUNSET
  if (up) {
    const t = (h - SUNRISE) / (SUNSET - SUNRISE)
    const elev = Math.sin(Math.PI * t) * PEAK_ELEVATION
    dirFrom(t, Math.max(elev, 2 * DEG), out.airDir)
    dirFrom(t, Math.max(elev, MIN_WATER_ELEVATION), out.waterDir)
  } else {
    const nightLen = 24 - (SUNSET - SUNRISE)
    const t = ((h - SUNSET + 24) % 24) / nightLen
    const elev = Math.sin(Math.PI * t) * 55 * DEG
    dirFrom(1 - t, Math.max(elev, 5 * DEG), out.airDir)
    dirFrom(1 - t, Math.max(elev, MIN_WATER_ELEVATION), out.waterDir)
  }
  const ss = THREE.MathUtils.smoothstep
  const dawnIn = ss(h, SUNRISE, SUNRISE + 1.2)
  const duskOut = 1 - ss(h, SUNSET - 1.2, SUNSET)
  out.day = Math.min(dawnIn, duskOut)
  out.night = 1 - out.day
  const morningWarm = 1 - ss(h, TIME.phases.aube + 1, TIME.phases.jour + 0.75)
  const eveningWarm = ss(h, TIME.phases.crepuscule - 1, TIME.phases.crepuscule + 1)
  out.warm = h < 12 ? morningWarm : eveningWarm
  tmp.copy(cJour)
  if (h < 12) tmp.lerp(cAube, morningWarm * 0.55)
  else tmp.lerp(cSoir, eveningWarm * 0.8)
  out.color.copy(cLune).lerp(tmp, out.day)
  out.intensity = THREE.MathUtils.lerp(0.25, 1.0, out.day)
  return out
}

export function createSunState(): SunState {
  return {
    airDir: new THREE.Vector3(0, 1, 0),
    waterDir: new THREE.Vector3(0, 1, 0),
    color: new THREE.Color(),
    intensity: 1,
    day: 1,
    night: 0,
    warm: 0,
  }
}
