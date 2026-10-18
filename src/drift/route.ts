import { DRIFT_ROUTE, DRIFT_SPEED, DRIFT_Y, SONDES } from '../core/layout'
import type { GameState } from '../core/types'
import type { DriftPose } from './frame'

const cumulative: number[] = [0]
for (let i = 1; i < DRIFT_ROUTE.length; i++) {
  const a = DRIFT_ROUTE[i - 1]!
  const b = DRIFT_ROUTE[i]!
  cumulative.push(cumulative[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z))
}
export const ROUTE_LENGTH = cumulative[cumulative.length - 1]!
export const METERS_PER_GAME_HOUR = DRIFT_SPEED * 60

export function distanceOf(waypointId: string): number {
  const i = DRIFT_ROUTE.findIndex((w) => w.id === waypointId)
  return i < 0 ? 0 : cumulative[i]!
}

export function pointAt(d: number): { x: number; z: number } {
  const t = Math.max(0, Math.min(ROUTE_LENGTH, d))
  for (let i = 1; i < DRIFT_ROUTE.length; i++) {
    if (t <= cumulative[i]! || i === DRIFT_ROUTE.length - 1) {
      const a = DRIFT_ROUTE[i - 1]!
      const b = DRIFT_ROUTE[i]!
      const seg = cumulative[i]! - cumulative[i - 1]!
      const u = seg > 0 ? (t - cumulative[i - 1]!) / seg : 0
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }
    }
  }
  const last = DRIFT_ROUTE[DRIFT_ROUTE.length - 1]!
  return { x: last.x, z: last.z }
}

export function headingAt(d: number): number {
  const span = 40
  const a = pointAt(Math.max(0, Math.min(ROUTE_LENGTH - span * 2, d - span)))
  const b = pointAt(Math.min(ROUTE_LENGTH, Math.max(span * 2, d + span)))
  return Math.atan2(b.x - a.x, -(b.z - a.z))
}

function gateReleased(id: string, state: GameState): boolean {
  if (id === 'halte-prairie') return state.act >= 2
  if (id === 'halte-coques') {
    if (state.act >= 3) return true
    return state.chart.sondes.filter((s) => s !== SONDES[0]!.id).length >= 3
  }
  return false
}

export function currentGate(state: GameState): { id: string; distance: number } {
  for (let i = 0; i < DRIFT_ROUTE.length; i++) {
    const w = DRIFT_ROUTE[i]!
    if (w.gate && !gateReleased(w.id, state)) return { id: w.id, distance: cumulative[i]! }
  }
  const last = DRIFT_ROUTE[DRIFT_ROUTE.length - 1]!
  return { id: last.id, distance: ROUTE_LENGTH }
}

export function minimumProgressForAct(state: GameState): number {
  if (state.act >= 3) return distanceOf('bord-du-blanc')
  if (state.act >= 2) return distanceOf('halte-prairie')
  return 0
}

export function poseAt(d: number, moving: boolean, scale: number, out: DriftPose): DriftPose {
  const p = pointAt(d)
  const h = headingAt(d)
  out.position.x = p.x
  out.position.y = DRIFT_Y
  out.position.z = p.z
  out.heading = h
  const speed = moving ? METERS_PER_GAME_HOUR * scale : 0
  out.velocity.x = Math.sin(h) * speed
  out.velocity.y = 0
  out.velocity.z = -Math.cos(h) * speed
  return out
}
