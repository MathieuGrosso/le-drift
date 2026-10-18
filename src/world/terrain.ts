import {
  BLANC_SLOPE, BLEU_EDGE, CAMPS, DRIFT_ROUTE, HAUTS_FONDS, LANDMARKS, REGIONS, SONDES, VISTA,
  type XZ,
} from '../core/layout'
import type { RegionId, Vec3 } from '../core/types'
import { fbm, ridged, valueNoise } from './noise'

export const FLOOR_MAX_Y = 117.2
export const SONDE_TOWER_HEIGHT = 22
export const VENT = { x: LANDMARKS.panache.x, z: LANDMARKS.panache.z, peak: 80, craterDepth: 13, baseRadius: 310 }

export const SILLON: readonly XZ[] = [
  { x: -340, z: 210 }, { x: -130, z: 115 }, { x: 70, z: 95 }, { x: 250, z: -10 }, { x: 360, z: -70 },
]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export function smax(a: number, b: number, k: number): number {
  const h = clamp01(0.5 + (0.5 * (a - b)) / k)
  return b + (a - b) * h + k * h * (1 - h)
}
export function smin(a: number, b: number, k: number): number {
  return -smax(-a, -b, k)
}

function terrace(h: number, step: number, sharp: number): number {
  const q = h / step
  const f = q - Math.floor(q)
  return (Math.floor(q) + Math.pow(f, sharp)) * step
}

export function distToPolyline(x: number, z: number, pts: readonly XZ[]): number {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const abx = b.x - a.x
    const abz = b.z - a.z
    const t = clamp01(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz))
    const dx = x - (a.x + abx * t)
    const dz = z - (a.z + abz * t)
    const d = dx * dx + dz * dz
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

export function routeDistance(x: number, z: number): number {
  return distToPolyline(x, z, DRIFT_ROUTE)
}

export function blancWeight(z: number): number {
  return smoothstep(BLANC_SLOPE.zStart + 90, BLANC_SLOPE.zStart - 60, z)
}

const SQRT1_2 = Math.SQRT1_2

function vistaRidge(x: number, z: number, h: number): number {
  const px = x - VISTA.hero.x
  const pz = z - VISTA.hero.z
  const along = (px + pz) * SQRT1_2
  const across = (px - pz) * SQRT1_2
  const w = (1 - smoothstep(200, 340, Math.abs(along))) * (1 - smoothstep(120, 230, Math.abs(across)))
  if (w <= 0) return h
  const crest = VISTA.ridgeY + 4 * valueNoise(along / 70, 3.1, 41) * smoothstep(25, 90, Math.abs(along))
  const fall = across > 0 ? smoothstep(0, 95, across) : smoothstep(0, 170, -across)
  const shoulder = across > 0 ? 12 : 19
  const ridge = mix(crest, shoulder, Math.pow(fall, 0.8)) + 1.2 * fbm(x / 14, z / 14, 2, 43) * fall
  return mix(h, smax(Math.min(h, 20), ridge, 5), w)
}

function pilier(x: number, z: number, h: number): number {
  const r0 = Math.hypot(x - LANDMARKS.pilier.x, z - LANDMARKS.pilier.z)
  if (r0 > 260) return h
  const mound = 24 * (1 - smoothstep(60, 240, r0))
  h = smax(h, 12 + mound, 8)
  const r = r0 * (1 + 0.24 * fbm(x / 28, z / 28, 2, 61))
  if (r > 70) return h
  const top = LANDMARKS.pilier.topY
  const t = clamp01((r - 9) / 42)
  let spire = top - (top - 22) * Math.pow(t, 0.75)
  spire = mix(spire, terrace(spire, 13, 3.2), 0.55 * smoothstep(0.08, 0.2, t))
  return smax(h, spire, 3)
}

function vent(x: number, z: number, h: number): number {
  const r = Math.hypot(x - VENT.x, z - VENT.z)
  if (r > VENT.baseRadius + 40) return h
  const cone = 8 + (VENT.peak - 8) * Math.pow(Math.max(0, 1 - r / VENT.baseRadius), 1.55)
  const rough = 7 * ridged(x / 70, z / 70, 3, 71) * smoothstep(20, 90, r) * (1 - smoothstep(200, 300, r))
  const crater = VENT.craterDepth * (1 - smoothstep(12, 30, r))
  return smax(h, cone + rough - crater, 8)
}

function knoll(x: number, z: number, h: number, cx: number, cz: number, top: number): number {
  const r = Math.hypot(x - cx, z - cz)
  const R = 70 + top * 0.6
  if (r > R) return h
  const rr = r * (1 + 0.2 * fbm(x / 22, z / 22, 2, 83))
  const k = top - (top - 4) * smoothstep(6, R, rr) + 2.5 * fbm(x / 9, z / 9, 2, 85) * smoothstep(8, 20, rr)
  return smax(h, k, 5)
}

function mesa(x: number, z: number, h: number, cx: number, cz: number, top: number, stretch: number): number {
  const dx = (x - cx) / stretch
  const dz = z - cz
  const r0 = Math.hypot(dx, dz)
  const Rb = 78
  if (r0 > Rb + 10) return h
  const r = r0 * (1 + 0.18 * fbm(x / 20, z / 20, 2, 91))
  const cliff = 1 - smoothstep(20, 38, r)
  const skirt = 1 - smoothstep(20, Rb, r)
  let m = top * (0.55 * cliff + 0.45 * skirt) + 0.6 * (1 - smoothstep(0, 14, r))
  m = mix(m, terrace(m, 9, 2.6), 0.5 * smoothstep(19, 24, r))
  return smax(h, m, 4)
}

function blanc(x: number, z: number, h: number): number {
  const w = blancWeight(z)
  if (w <= 0) return h
  const t = clamp01((BLANC_SLOPE.zStart - z) / (BLANC_SLOPE.zStart - BLANC_SLOPE.zEnd))
  const extra = smoothstep(BLANC_SLOPE.zEnd, BLANC_SLOPE.zEnd - 90, z) * 5
  const base = BLANC_SLOPE.yStart + (BLANC_SLOPE.yEnd - BLANC_SLOPE.yStart) * t + extra
  const ripples = 7 * ridged(x / 75 + fbm(x / 300, z / 300, 2, 101) * 0.8, z / 230, 2, 103)
    + 1.2 * valueNoise(x / 9, z / 22, 105)
  const swell = 6 * fbm(x / 260, z / 180, 3, 107)
  return mix(h, base + ripples + swell, w)
}

function regionBorderRidges(x: number, z: number): number {
  let d1 = Infinity
  let d2 = Infinity
  for (const k in REGIONS) {
    const c = REGIONS[k as keyof typeof REGIONS]
    const d = Math.hypot(x - c.x, z - c.z)
    if (d < d1) {
      d2 = d1
      d1 = d
    } else if (d < d2) d2 = d
  }
  const border = 1 - smoothstep(0, 170, d2 - d1)
  const amp = mix(26, 13, smoothstep(150, 420, z))
  return border * (10 + amp * ridged(x / 380, z / 380, 3, 7)) * (0.6 + 0.4 * fbm(x / 600, z / 600, 2, 9))
}

function heightNoCamps(x: number, z: number): number {
  let h = 14 + 9 * fbm(x / 420, z / 420, 4, 1) + 2.5 * fbm(x / 90, z / 90, 3, 2)

  const prairie = smoothstep(260, 470, z)
  if (prairie > 0) {
    const s = z / 95 + 1.4 * fbm(x / 300, z / 300, 2, 3)
    const p = s - Math.floor(s)
    const prof = p < 0.72 ? p / 0.72 : (1 - p) / 0.28
    const crest = smoothstep(-0.25, 0.55, valueNoise(x / 170, Math.floor(s) * 1.7, 5))
    const amp = 6 + 6 * (0.5 + 0.5 * valueNoise(x / 230, z / 230, 4))
    h += prairie * crest * amp * prof * prof * (3 - 2 * prof)
  }

  const rough = 1 - prairie * 0.75
  h = smax(h, h + regionBorderRidges(x, z) * rough, 6)

  const canyon = smoothstep(0.8, 0.95, ridged(x / 520, z / 520, 1, 13)) * (1 - prairie) * (1 - blancWeight(z))
  h -= canyon * 20

  const plateau = smoothstep(0.22, 0.42, fbm(x / 700, z / 700, 2, 11)) * (1 - prairie) * (1 - blancWeight(z))
  if (plateau > 0) h = mix(h, terrace(h, 11, 3), plateau * 0.7)

  const lam = 1 - smoothstep(190, 340, Math.hypot(x - REGIONS.laminaires.x, z - REGIONS.laminaires.z))
  if (lam > 0) h = mix(h, 11 + 4 * fbm(x / 120, z / 120, 3, 21), lam * 0.75)

  const coq = 1 - smoothstep(150, 290, Math.hypot(x - REGIONS.coques.x, z - REGIONS.coques.z))
  if (coq > 0) h = mix(h, 7 + 5 * fbm(x / 110, z / 110, 3, 23), coq * 0.6)

  h = vistaRidge(x, z, h)
  h = pilier(x, z, h)
  h = vent(x, z, h)
  h = blanc(x, z, h)

  for (const s of SONDES) {
    if (s.id === 'sonde-pilier') continue
    h = knoll(x, z, h, s.x, s.z, s.topY - SONDE_TOWER_HEIGHT)
  }
  for (const hf of HAUTS_FONDS) {
    h = mesa(x, z, h, hf.x, hf.z, 120 - hf.topBelowCeiling, hf.id === 'hf-12' ? 2.2 : 1)
  }

  const ds = distToPolyline(x, z, SILLON)
  if (ds < 60) h = mix(-9 + 3 * fbm(x / 30, z / 30, 2, 31), h, smoothstep(13, 52, ds))

  return h
}

function edges(x: number, z: number, h: number): number {
  const east = smoothstep(940, 1010, x)
  if (east > 0) h = mix(h, 108 + 6 * fbm(x / 40, z / 60, 3, 51), east)
  const south = smoothstep(BLEU_EDGE - 40, BLEU_EDGE + 90, z)
  const west = smoothstep(BLEU_EDGE - 40, BLEU_EDGE + 90, -x)
  const drop = Math.max(south, west)
  if (drop > 0) h = mix(h, -230, drop * drop)
  return h
}

export function heightAt(x: number, z: number): number {
  let h = heightNoCamps(x, z)
  for (const c of CAMPS) {
    const r = Math.hypot(x - c.x, z - c.z)
    if (r < 30) h = mix(heightNoCamps(c.x, c.z), h, smoothstep(9, 30, r))
  }
  const dr = routeDistance(x, z)
  if (dr < 190) h = smin(h, 30 + smoothstep(135, 180, dr) * 120, 6)
  h = edges(x, z, h)
  return h > FLOOR_MAX_Y ? FLOOR_MAX_Y : h
}

export function normalAt(x: number, z: number, e = 1): Vec3 {
  const hx = heightAt(x + e, z) - heightAt(x - e, z)
  const hz = heightAt(x, z + e) - heightAt(x, z - e)
  const nx = -hx
  const ny = 2 * e
  const nz = -hz
  const l = Math.hypot(nx, ny, nz)
  return { x: nx / l, y: ny / l, z: nz / l }
}

export function regionAt(x: number, z: number): RegionId {
  if (z > BLEU_EDGE || x < -BLEU_EDGE) return 'bleu'
  if (x > BLEU_EDGE) return 'cheminee'
  if (z < BLANC_SLOPE.zStart + 30 * valueNoise(x / 120, 0.5, 111)) return 'blanc'
  let best: RegionId = 'prairie'
  let bd = Infinity
  for (const k in REGIONS) {
    if (k === 'blanc') continue
    const c = REGIONS[k as keyof typeof REGIONS]
    const d = Math.hypot(x - c.x, (z - c.z) * (k === 'prairie' ? 0.75 : 1))
    if (d < bd) {
      bd = d
      best = k as RegionId
    }
  }
  return best
}
