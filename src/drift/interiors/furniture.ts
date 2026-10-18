import * as THREE from 'three'
import type { ColliderKind } from '../../core/types'
import { GeoBuilder } from '../builder'
import { softColor } from '../figure'
import { PAL } from '../palette'
import { SURF, patForColor } from '../surface'
import { REBORD } from './layout'
import { FOOTPRINTS, QUARTER_SCALE, mapX, mapZ, partPoint } from './scale'
import type { ColliderSpec, LadderDef, LampDef, PendulumDef, SeatDef, Spot } from './types'

export interface Decal {
  kind: 'board' | 'chart' | 'drawings' | 'menu'
  part: string
  x: number; y: number; z: number
  w: number; h: number
  normal: THREE.Vector3
  up: THREE.Vector3
}

export interface FurnitureOut {
  colliders: ColliderSpec[]
  lamps: LampDef[]
  seats: SeatDef[]
  ladders: LadderDef[]
  pendulums: PendulumDef[]
  spots: Record<string, Spot & { part: string }>
  benchSeats: (Spot & { part: string })[]
  decals: Decal[]
  steam: { part: string; x: number; y: number; z: number; big?: boolean }[]
}

export function emptyFurniture(): FurnitureOut {
  return { colliders: [], lamps: [], seats: [], ladders: [], pendulums: [], spots: {}, benchSeats: [], decals: [], steam: [] }
}

type Ctx = { part: string; b: GeoBuilder; fade: GeoBuilder; out: FurnitureOut; rand: () => number; e: GeoBuilder; delta: THREE.Vector3 | null }

// Room code is authored in the legacy quarter frame (see scale.ts): every position goes through at().
function at(c: Ctx, x: number, y: number, z: number): { x: number; y: number; z: number } {
  if (c.delta) return { x: x + c.delta.x, y: y + c.delta.y, z: z + c.delta.z }
  return partPoint(c.part, x, y, z)
}

function rigid(c: Ctx, x: number, y: number, z: number, fn: () => void): void {
  if (c.delta) return fn()
  const m = partPoint(c.part, x, y, z)
  c.delta = new THREE.Vector3(m.x - x, m.y - y, m.z - z)
  try {
    fn()
  } finally {
    c.delta = null
  }
}

function placed(c: Ctx, fn: () => void): void {
  const prev = c.delta
  c.delta = new THREE.Vector3()
  try {
    fn()
  } finally {
    c.delta = prev
  }
}

function put<T extends { x: number; y: number; z: number }>(c: Ctx, v: T): T & { part: string } {
  return { ...v, ...at(c, v.x, v.y, v.z), part: c.part }
}

function span(c: Ctx, u0: number, u1: number, y: number, w: number, alongZ: boolean): [number, number, number, number] {
  const a = alongZ ? at(c, w, y, u0) : at(c, u0, y, w)
  const b = alongZ ? at(c, w, y, u1) : at(c, u1, y, w)
  return alongZ ? [a.z, b.z, a.y, a.x] : [a.x, b.x, a.y, a.z]
}

function col(c: Ctx, kind: ColliderKind, x: number, y: number, z: number, hx: number, hy: number, hz: number, ownerId?: string): void {
  c.out.colliders.push({ part: c.part, kind, climbable: false, ...at(c, x, y, z), hx, hy, hz, ...(ownerId ? { ownerId } : {}) })
}

// A hanging lamp keeps its pivot on the raised ceiling and lets down half of the rise as extra cord.
function lamp(c: Ctx, x: number, y: number, z: number, cord: number, color: number = PAL.lampe, radius = 6.5, airlock?: 'sas' | 'echelle-toit', flags: { hidden?: boolean; night?: boolean } = {}): void {
  const pivot = at(c, x, y + cord, z)
  const len = cord > 0 ? cord + (pivot.y - y - cord) * 0.5 : 0
  const r = cord > 0 ? radius * 1.35 : radius
  c.out.lamps.push({ part: c.part, x: pivot.x, y: pivot.y - len, z: pivot.z, cord: len, color, radius: r, ...(airlock ? { airlock } : {}), ...flags })
}

function spot(c: Ctx, id: string, x: number, y: number, z: number, yaw: number): void {
  c.out.spots[id] = { part: c.part, ...at(c, x, y, z), yaw }
}

const YAW_N = 0
const YAW_E = Math.PI / 2
const YAW_S = Math.PI
const YAW_W = -Math.PI / 2

function crate(c: Ctx, x: number, z: number, s: number, stack = 1, solid = true): void {
  rigid(c, x, 0, z, () => {
    for (let i = 0; i < stack; i++) {
      const r = c.rand()
      c.b.box(x + (r - 0.5) * 0.08, s / 2 + i * s, z, s, s, s, r > 0.5 ? PAL.bois : PAL.boisClair, (r - 0.5) * 0.5)
      c.b.box(x, s / 2 + i * s, z, s * 1.02, s * 0.12, s * 1.02, PAL.boisOmbre)
    }
    if (solid) col(c, 'prop', x, (s * stack) / 2, z, s / 2, (s * stack) / 2, s / 2)
  })
}

function barrel(c: Ctx, x: number, z: number, r = 0.32, h = 0.85): void {
  rigid(c, x, 0, z, () => {
    c.b.cyl(x, h / 2, z, r, h, PAL.bois)
    c.b.cyl(x, h * 0.2, z, r * 1.03, 0.06, PAL.metalSombre)
    c.b.cyl(x, h * 0.8, z, r * 1.03, 0.06, PAL.metalSombre)
    col(c, 'prop', x, h / 2, z, r, h / 2, r)
  })
}

function jarRow(c: Ctx, x0: number, x1: number, y: number, z: number, alongZ = false): void {
  const m = (x0 + x1) / 2
  rigid(c, alongZ ? z : m, y, alongZ ? m : z, () => jars(c, x0, x1, y, z, alongZ))
}

function jars(c: Ctx, x0: number, x1: number, y: number, z: number, alongZ: boolean): void {
  const n = Math.floor(Math.abs(x1 - x0) / 0.22)
  const colors = [PAL.revetement, PAL.tissu2, PAL.clair, PAL.tissu1, PAL.laiton, PAL.vertDoux]
  for (let i = 0; i < n; i++) {
    const t = x0 + (i + 0.5) * ((x1 - x0) / n)
    const h = 0.14 + c.rand() * 0.16
    const r = 0.05 + c.rand() * 0.04
    const color = colors[Math.floor(c.rand() * colors.length)]!
    if (alongZ) c.b.cyl(z, y + h / 2, t, r, h, color)
    else c.b.cyl(t, y + h / 2, z, r, h, color)
  }
}

function shelf(c: Ctx, x: number, z: number, len: number, ys: number[], alongZ: boolean, depth = 0.3): void {
  rigid(c, x, 0, z, () => {
    for (const y of ys) {
      if (alongZ) c.b.box(x, y, z, depth, 0.04, len, PAL.bois)
      else c.b.box(x, y, z, len, 0.04, depth, PAL.bois)
      if (alongZ) jarRow(c, z - len / 2 + 0.1, z + len / 2 - 0.1, y + 0.02, x, true)
      else jarRow(c, x - len / 2 + 0.1, x + len / 2 - 0.1, y + 0.02, z)
    }
  })
}

function table(c: Ctx, x: number, z: number, sx: number, sz: number, h: number, color: number = PAL.bois): void {
  rigid(c, x, 0, z, () => {
    c.b.box(x, h - 0.03, z, sx, 0.06, sz, color)
    const lx = sx / 2 - 0.08
    const lz = sz / 2 - 0.08
    for (const [dx, dz] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]] as const) c.b.box(x + dx, (h - 0.06) / 2, z + dz, 0.07, h - 0.06, 0.07, PAL.boisOmbre)
  })
}

function stool(c: Ctx, x: number, z: number, h = 0.48, color: number = PAL.bois): void {
  rigid(c, x, 0, z, () => {
    c.b.cyl(x, h - 0.03, z, 0.2, 0.06, color)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      c.b.box(x + Math.cos(a) * 0.12, (h - 0.06) / 2, z + Math.sin(a) * 0.12, 0.04, h - 0.06, 0.04, PAL.boisOmbre)
    }
  })
}

const soft = (hex: number, k = 0.6, l = 1): THREE.Color => softColor(new THREE.Color(hex), k).multiplyScalar(l)
const UPV = new THREE.Vector3(0, 1, 0)

function bunk(c: Ctx, x: number, z: number, sx: number, sz: number, blanket: number): void {
  rigid(c, x, 0, z, () => {
    const alongZ = sz > sx
    const L = alongZ ? sz : sx
    const W = alongZ ? sx : sz
    const at = (u: number, v: number): [number, number] => (alongZ ? [x + v, z + u] : [x + u, z + v])
    const box = (u: number, y: number, v: number, lu: number, h: number, lv: number, col: THREE.ColorRepresentation, r = 0.02) => {
      const [px, pz] = at(u, v)
      c.b.rbox(px, y, pz, alongZ ? lv : lu, h, alongZ ? lu : lv, col, r)
    }
    const wood = new THREE.Color(PAL.bois).multiplyScalar(0.82)
    c.b.with(SURF.planksX, () => {
      for (const s of [-1, 1]) box(0, 0.3, s * (W / 2 - 0.03), L, 0.16, 0.06, wood)
      box(L / 2 - 0.03, 0.42, 0, 0.06, 0.62, W, wood, 0.025)
      box(-L / 2 + 0.03, 0.34, 0, 0.06, 0.42, W, wood, 0.025)
      box(L / 2 - 0.03, 0.76, 0, 0.09, 0.07, W + 0.06, new THREE.Color(PAL.boisOmbre).multiplyScalar(1.15), 0.03)
    })
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const [px, pz] = at(su * (L / 2 - 0.03), sv * (W / 2 - 0.03))
      const h = su > 0 ? 0.82 : 0.6
      c.b.cyl(px, h / 2, pz, 0.035, h, PAL.boisOmbre)
      c.b.sphere(px, h + 0.02, pz, 0.045, 0.04, 0.045, PAL.laiton)
    }
    box(0, 0.26, 0, L - 0.08, 0.04, W - 0.08, PAL.boisOmbre)
    c.b.with(SURF.fabric, () => box(0, 0.36, 0, L - 0.14, 0.15, W - 0.1, soft(PAL.toile, 0.7, 0.92), 0.06))
    const quilt = [soft(blanket, 0.6, 0.9), soft(PAL.creme, 0.6, 0.86), soft(0xd9a05a, 0.55, 0.85), soft(blanket, 0.6, 0.72), soft(0x8fa8a0, 0.5, 0.82), soft(0xe0b08c, 0.55, 0.88)]
    const qL = L * 0.7
    const q0 = -L / 2 + 0.06
    const nu = 6
    const nv = 3
    c.b.with(SURF.fabric, () => {
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = q0 + (i + 0.5) * (qL / nu)
        const v = -W / 2 + (j + 0.5) * (W / nv)
        box(u, 0.452 + ((i + j) % 2) * 0.006, v * 1.02, qL / nu + 0.004, 0.05, W / nv + 0.004, quilt[(i * 2 + j * 3 + (i > 2 ? 1 : 0)) % quilt.length]!, 0.02)
      }
      for (const sv of [-1, 1]) for (let i = 0; i < nu; i++) {
        const u = q0 + (i + 0.5) * (qL / nu)
        box(u, 0.33, sv * (W / 2 + 0.01), qL / nu + 0.004, 0.22, 0.035, quilt[(i * 2 + (sv > 0 ? 2 : 0)) % quilt.length]!.clone().multiplyScalar(0.86), 0.015)
      }
      box(q0 + qL + 0.05, 0.47, 0, 0.14, 0.07, W + 0.03, soft(PAL.creme, 0.6, 0.9), 0.03)
    })
    const [px, pz] = at(L / 2 - 0.3, 0)
    c.b.with(SURF.fabric, () => {
      c.b.add(sphereLow, new THREE.Matrix4().compose(new THREE.Vector3(px, 0.52, pz), new THREE.Quaternion(), new THREE.Vector3(alongZ ? W * 0.36 : 0.2, 0.085, alongZ ? 0.2 : W * 0.36)), soft(PAL.blanc, 0.5, 0.94))
      const [qx, qz] = at(L / 2 - 0.48, W * 0.12)
      c.b.add(sphereLow, new THREE.Matrix4().compose(new THREE.Vector3(qx, 0.55, qz), new THREE.Quaternion().setFromAxisAngle(UPV, 0.4), new THREE.Vector3(0.13, 0.08, 0.15)), soft(0x8fa8a0, 0.6, 0.86))
    })
  })
}

function rug(c: Ctx, lx: number, lz: number, lsx: number, lsz: number, color: number, stripe: number): void {
  const a = at(c, lx - lsx / 2, 0, lz - lsz / 2)
  const b = at(c, lx + lsx / 2, 0, lz + lsz / 2)
  const x = (a.x + b.x) / 2
  const z = (a.z + b.z) / 2
  const sx = Math.min(b.x - a.x, lsx * QUARTER_SCALE)
  const sz = Math.min(b.z - a.z, lsz * QUARTER_SCALE)
  placed(c, () => weave(c, x, z, sx, sz, color, stripe))
}

function weave(c: Ctx, x: number, z: number, sx: number, sz: number, color: number, stripe: number): void {
  const tones = [soft(color, 0.5, 0.78), soft(stripe, 0.5, 0.8), soft(PAL.toile, 0.5, 0.78), soft(color, 0.5, 0.64), soft(0xb08a5a, 0.5, 0.8)]
  const half = Math.min(sx, sz) / 2
  const rings = Math.min(9, Math.floor((half - 0.05) / 0.055))
  const tube = 0.03
  for (let k = 0; k < rings; k++) {
    const inset = 0.035 + k * 0.055
    const hx = sx / 2 - inset
    const hz = sz / 2 - inset
    const per = 2 * (hx + hz) * 2
    const n = Math.min(180, Math.max(24, Math.ceil(per / 0.09)))
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const cx = Math.cos(a)
      const cz = Math.sin(a)
      const px = Math.sign(cx) * Math.pow(Math.abs(cx), 0.4) * hx
      const pz = Math.sign(cz) * Math.pow(Math.abs(cz), 0.4) * hz
      pts.push(new THREE.Vector3(px, 0, pz))
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), n, tube, 4, true)
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0.014, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.42, 1))
    c.b.with(SURF.fabric, () => c.b.add(g, m, tones[(k + (k > 2 ? 1 : 0)) % tones.length]!))
  }
  const inner = 0.035 + rings * 0.055
  if (sx / 2 - inner > 0.05 && sz / 2 - inner > 0.05) {
    c.b.with(SURF.fabric, () => c.b.rbox(x, 0.012, z, (sx - inner * 2) * 0.9 + 0.04, 0.018, (sz - inner * 2) * 0.9 + 0.04, tones[0]!, 0.008))
  }
}

function tallPlant(c: Ctx, x: number, z: number, s: number): void {
  rigid(c, x, 0, z, () => {
    c.b.with(SURF.fabric, () => c.b.cyl(x, 0.22 * s, z, 0.24 * s, 0.44 * s, soft(0x9a6a50, 0.6, 0.85)))
    c.b.cyl(x, 0.45 * s, z, 0.26 * s, 0.05 * s, soft(0x7a5040, 0.6, 0.8))
    const greens = [0x4f6f45, 0x5e7f4a, 0x6f8f4e, 0x45604a]
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + c.rand() * 0.5
      const tilt = 0.35 + c.rand() * 0.45
      const len = (0.7 + c.rand() * 0.6) * s
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt))
      const base = new THREE.Vector3(x, 0.48 * s, z)
      const tip = new THREE.Vector3(0, len, 0).applyQuaternion(q).add(base)
      c.b.add(UNIT_CYL, new THREE.Matrix4().compose(base.clone().lerp(tip, 0.5), q, new THREE.Vector3(0.012, len, 0.012)), 0x4a5a3a)
      c.b.add(sphereLow, new THREE.Matrix4().compose(base.clone().lerp(tip, 0.72), q, new THREE.Vector3(0.11 * s, len * 0.36, 0.035 * s)), greens[i % greens.length]!)
    }
  })
}

function plantPot(c: Ctx, x: number, y: number, z: number, s = 1): void {
  rigid(c, x, y, z, () => {
    c.b.cyl(x, y + 0.17 * s, z, 0.17 * s, 0.34 * s, soft(PAL.rouille, 0.7, 0.85))
    c.b.cyl(x, y + 0.34 * s, z, 0.19 * s, 0.05 * s, soft(PAL.rouille, 0.7, 0.7))
    const greens = [0x5e7f4a, 0x6f8f4e, 0x4f6f45, 0x7f9a5a]
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + c.rand()
      const r = (0.08 + c.rand() * 0.14) * s
      c.b.sphere(x + Math.cos(a) * r, y + (0.42 + c.rand() * 0.38) * s, z + Math.sin(a) * r, 0.13 * s, 0.2 * s, 0.13 * s, greens[i % greens.length]!)
    }
  })
}

function books(c: Ctx, x: number, y: number, z: number, len: number, depth: number, alongZ: boolean, maxH: number): void {
  const spines = [0x7a3a34, 0x3e5a4a, 0x34485e, 0x8a6a3a, 0x5a3a4a, 0x6a5a48, 0x4a5a6a, 0x9a7a52]
  let u = -len / 2 + 0.03
  while (u < len / 2 - 0.05) {
    const r = c.rand()
    if (r < 0.08 && u < len / 2 - 0.3) {
      for (let k = 0; k < 3; k++) {
        const col = soft(spines[Math.floor(c.rand() * spines.length)]!, 0.75, 0.9)
        const px = alongZ ? x : x + u + 0.13
        const pz = alongZ ? z + u + 0.13 : z
        c.b.box(px, y + 0.03 + k * 0.05, pz, alongZ ? depth * 0.8 : 0.24, 0.045, alongZ ? 0.24 : depth * 0.8, col, c.rand() * 0.3)
      }
      u += 0.3
      continue
    }
    if (r < 0.12) {
      u += 0.06 + c.rand() * 0.08
      continue
    }
    const w = 0.03 + c.rand() * 0.035
    const h = Math.min(maxH, 0.2 + c.rand() * 0.14)
    const col = soft(spines[Math.floor(c.rand() * spines.length)]!, 0.75, 0.82 + c.rand() * 0.2)
    const lean = c.rand() < 0.07 ? 0.18 : 0
    const m = new THREE.Matrix4().compose(
      alongZ ? new THREE.Vector3(x, y + h / 2, z + u + w / 2) : new THREE.Vector3(x + u + w / 2, y + h / 2, z),
      new THREE.Quaternion().setFromAxisAngle(alongZ ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), lean),
      alongZ ? new THREE.Vector3(depth * (0.7 + c.rand() * 0.2), h, w) : new THREE.Vector3(w, h, depth * (0.7 + c.rand() * 0.2)),
    )
    c.b.add(boxGeo, m, col)
    if (c.rand() < 0.6) {
      const ly = y + h * 0.72
      if (alongZ) c.b.box(x, ly, z + u + w / 2, depth * 0.72, 0.02, w * 1.04, soft(PAL.creme, 0.6, 0.75))
      else c.b.box(x + u + w / 2, ly, z, w * 1.04, 0.02, depth * 0.72, soft(PAL.creme, 0.6, 0.75))
    }
    u += w + 0.004 + lean * 0.2
  }
}

function bookcase(c: Ctx, x: number, z: number, len: number, h: number, depth: number, alongZ: boolean, face: number, levels: number[]): void {
  rigid(c, x, 0, z, () => {
    const dark = new THREE.Color(PAL.boisOmbre).multiplyScalar(1.05)
    const wood = new THREE.Color(PAL.bois).multiplyScalar(0.7)
    const back = alongZ ? x - face * (depth / 2 - 0.015) : x
    const backZ = alongZ ? z : z - face * (depth / 2 - 0.015)
    c.b.with(SURF.paint, () => {
      if (alongZ) c.b.box(back, h / 2, z, 0.03, h, len, new THREE.Color(PAL.interieurOmbre).multiplyScalar(1.2))
      else c.b.box(x, h / 2, backZ, len, h, 0.03, new THREE.Color(PAL.interieurOmbre).multiplyScalar(1.2))
    })
    c.b.with(SURF.planksX, () => {
      for (const s of [-1, 1]) {
        if (alongZ) c.b.rbox(x, h / 2, z + s * (len / 2 - 0.025), depth, h, 0.05, dark, 0.012)
        else c.b.rbox(x + s * (len / 2 - 0.025), h / 2, z, 0.05, h, depth, dark, 0.012)
      }
      if (alongZ) {
        c.b.rbox(x + face * 0.02, h + 0.04, z, depth + 0.06, 0.08, len + 0.1, dark, 0.02)
        c.b.rbox(x, 0.05, z, depth, 0.1, len, dark, 0.01)
      } else {
        c.b.rbox(x, h + 0.04, z + face * 0.02, len + 0.1, 0.08, depth + 0.06, dark, 0.02)
        c.b.rbox(x, 0.05, z, len, 0.1, depth, dark, 0.01)
      }
      for (const y of levels) {
        if (alongZ) c.b.box(x, y, z, depth - 0.02, 0.03, len - 0.08, wood)
        else c.b.box(x, y, z, len - 0.08, 0.03, depth - 0.02, wood)
      }
    })
    const mid = alongZ ? x + face * 0.03 : x
    const midZ = alongZ ? z : z + face * 0.03
    levels.forEach((y, i) => {
      const gap = (levels[i + 1] ?? h) - y - 0.06
      books(c, mid, y + 0.015, midZ, len - 0.12, depth - 0.06, alongZ, gap)
    })
  })
}

function turnedLeg(c: Ctx, x: number, z: number, h: number, color: THREE.ColorRepresentation): void {
  c.b.cyl(x, h / 2, z, 0.045, h, color)
  for (const k of [0.25, 0.7]) c.b.cyl(x, h * k, z, 0.06, 0.04, color)
  c.b.sphere(x, 0.03, z, 0.055, 0.04, 0.055, color)
}

function chair(c: Ctx, x: number, z: number, faceZ: number, cushion: number): void {
  rigid(c, x, 0, z, () => {
    const wood = new THREE.Color(PAL.bois).multiplyScalar(0.72)
    const dark = new THREE.Color(PAL.boisOmbre).multiplyScalar(1.1)
    c.b.with(SURF.planksX, () => c.b.rbox(x, 0.46, z, 0.48, 0.05, 0.46, wood, 0.02))
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const back = sz === -faceZ
      const h = back ? 1.05 : 0.44
      c.b.rbox(x + sx * 0.2, h / 2, z + sz * 0.19, 0.045, h, 0.045, dark, 0.012)
    }
    const bz = z - faceZ * 0.19
    for (const y of [0.18]) for (const sx of [-1, 1]) c.b.box(x + sx * 0.2, y, z, 0.03, 0.03, 0.38, dark)
    for (let i = -1; i <= 1; i++) c.b.rbox(x + i * 0.09, 0.78, bz, 0.035, 0.5, 0.025, wood, 0.01)
    c.b.rbox(x, 1.04, bz, 0.5, 0.09, 0.05, wood, 0.025)
    c.b.rbox(x, 0.56, bz, 0.42, 0.05, 0.035, wood, 0.012)
    c.b.with(SURF.fabric, () => c.b.rbox(x, 0.505, z + faceZ * 0.02, 0.42, 0.05, 0.4, soft(cushion, 0.55, 0.85), 0.022))
  })
}

function armchair(c: Ctx, x: number, z: number, faceZ: number, cloth: number): void {
  rigid(c, x, 0, z, () => {
    const wood = new THREE.Color(PAL.boisOmbre).multiplyScalar(1.15)
    const f = soft(cloth, 0.55, 0.78)
    const f2 = soft(cloth, 0.55, 0.66)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b.cyl(x + sx * 0.36, 0.06, z + sz * 0.3, 0.035, 0.12, wood)
    c.b.with(SURF.fabric, () => {
      c.b.rbox(x, 0.25, z, 0.8, 0.26, 0.7, f2, 0.06)
      c.b.rbox(x, 0.42, z + faceZ * 0.04, 0.6, 0.12, 0.6, f, 0.05)
      c.b.rbox(x, 0.72, z - faceZ * 0.3, 0.8, 0.72, 0.16, f2, 0.07)
      c.b.rbox(x, 0.66, z - faceZ * 0.22, 0.56, 0.42, 0.1, f, 0.05)
      for (const s of [-1, 1]) c.b.rbox(x + s * 0.36, 0.5, z + faceZ * 0.02, 0.12, 0.26, 0.66, f2, 0.05)
    })
    for (const s of [-1, 1]) c.b.rbox(x + s * 0.36, 0.64, z + faceZ * 0.04, 0.13, 0.03, 0.6, wood, 0.012)
    c.b.with(SURF.fabric, () => c.b.rbox(x + 0.12, 0.88, z - faceZ * 0.22, 0.34, 0.24, 0.07, soft(PAL.tissu2, 0.5, 0.85), 0.04, 0.25))
  })
}

function copperPot(c: Ctx, b: GeoBuilder, x: number, y: number, z: number, r: number, h: number): void {
  rigid(c, x, y, z, () => {
    const cu = new THREE.Color(0xc9824e).multiplyScalar(0.9)
    b.with(SURF.brass, () => {
      b.cyl(x, y + h / 2, z, r, h, cu)
      b.cyl(x, y + h, z, r * 1.06, 0.03, new THREE.Color(0xd9a06a))
      b.cyl(x, y + 0.02, z, r * 0.96, 0.04, new THREE.Color(0x8a5238))
    })
    for (const s of [-1, 1]) b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(x + s * (r + 0.03), y + h * 0.78, z), new THREE.Quaternion(), new THREE.Vector3(0.05, 0.05, 0.05)), PAL.laiton)
  })
}

function fishString(c: Ctx, x: number, y: number, z: number, n: number, alongZ: boolean): void {
  rigid(c, x, y, z, () => {
    c.fade.cyl(x, y - n * 0.075, z, 0.005, n * 0.15 + 0.05, PAL.corde)
    for (let i = 0; i < n; i++) {
      const yy = y - 0.1 - i * 0.15
      const col = soft(i % 2 ? 0x9a8a6a : 0xa89a74, 0.8, 0.95)
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, yy, z), new THREE.Quaternion().setFromAxisAngle(UPV, alongZ ? 0 : Math.PI / 2), new THREE.Vector3(0.022, 0.06, 0.04))
      c.fade.add(sphereLow, m, col)
      c.fade.add(coneGeo, new THREE.Matrix4().compose(new THREE.Vector3(x, yy + 0.07, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), new THREE.Vector3(0.03, 0.04, 0.012)), col)
    }
  })
}

function onionString(c: Ctx, x: number, y: number, z: number, n: number): void {
  rigid(c, x, y, z, () => {
    c.fade.cyl(x, y - n * 0.04, z, 0.006, n * 0.08 + 0.06, PAL.corde)
    for (let i = 0; i < n; i++) {
      const a = i * 2.4
      const col = i % 3 === 0 ? soft(0x8a5a6a, 0.7) : soft(0xc08a50, 0.75)
      c.fade.sphere(x + Math.cos(a) * 0.035, y - 0.08 - i * 0.075, z + Math.sin(a) * 0.035, 0.042, 0.038, 0.042, col)
    }
  })
}

function cat(c: Ctx, x: number, y: number, z: number, yaw: number): void {
  rigid(c, x, y, z, () => {
    const fur = soft(0xb07a50, 0.75)
    const cream = soft(0xe8d4b0, 0.7)
    const q = new THREE.Quaternion().setFromAxisAngle(UPV, yaw)
    const put = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, col: THREE.Color, geo: THREE.BufferGeometry = sphereLow, rot?: THREE.Quaternion) => {
      const p = new THREE.Vector3(dx, dy, dz).applyQuaternion(q).add(new THREE.Vector3(x, y, z))
      c.b.add(geo, new THREE.Matrix4().compose(p, rot ? q.clone().multiply(rot) : q, new THREE.Vector3(sx, sy, sz)), col)
    }
    put(0, 0.09, 0, 0.13, 0.1, 0.19, fur)
    put(0, 0.08, -0.12, 0.08, 0.07, 0.06, cream)
    put(0, 0.15, -0.16, 0.075, 0.065, 0.07, fur)
    put(0, 0.13, -0.215, 0.035, 0.025, 0.02, cream)
    for (const s of [-1, 1]) {
      put(s * 0.042, 0.215, -0.16, 0.025, 0.045, 0.018, fur, coneGeo)
      put(s * 0.026, 0.16, -0.225, 0.008, 0.004, 0.004, new THREE.Color(0x2e2a44))
    }
    put(0.1, 0.05, 0.08, 0.13, 0.13, 0.13, fur, tailGeo, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2))
  })
}

function pipe(c: Ctx, lx0: number, lx1: number, ly: number, lz: number, r: number, color: number, alongZ = false): void {
  const [x0, x1, y, z] = span(c, lx0, lx1, ly, lz, alongZ)
  placed(c, () => pipeRun(c, x0, x1, y, z, r, color, alongZ))
}

function pipeRun(c: Ctx, x0: number, x1: number, y: number, z: number, r: number, color: number, alongZ: boolean): void {
  const len = Math.abs(x1 - x0)
  const m = (x0 + x1) / 2
  if (alongZ) c.b.cyl(z, y, m, r, len, color, 'z')
  else c.b.cyl(m, y, z, r, len, color, 'x')
  const n = Math.floor(len / 2.4)
  for (let i = 0; i <= n; i++) {
    const t = Math.min(x0, x1) + (i * len) / Math.max(1, n)
    if (alongZ) c.b.cyl(z, y, t, r * 1.5, 0.08, PAL.laiton, 'z')
    else c.b.cyl(t, y, z, r * 1.5, 0.08, PAL.laiton, 'x')
  }
}

function laundry(c: Ctx, lx0: number, lx1: number, ly: number, lz: number, alongZ = false): void {
  const [x0, x1, y, z] = span(c, lx0, lx1, ly, lz, alongZ)
  placed(c, () => laundryRun(c, x0, x1, y, z, alongZ))
}

function laundryRun(c: Ctx, x0: number, x1: number, y: number, z: number, alongZ: boolean): void {
  const len = Math.abs(x1 - x0)
  const m = (x0 + x1) / 2
  if (alongZ) c.fade.cyl(z, y, m, 0.012, len, PAL.corde, 'z')
  else c.fade.cyl(m, y, z, 0.012, len, PAL.corde, 'x')
  const colors = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.blanc, PAL.echarpe]
  let t = Math.min(x0, x1) + 0.4
  while (t < Math.max(x0, x1) - 0.4) {
    const w = 0.35 + c.rand() * 0.4
    const h = 0.3 + c.rand() * 0.45
    const color = colors[Math.floor(c.rand() * colors.length)]!
    if (alongZ) c.fade.box(z, y - h / 2, t, 0.02, h, w, color)
    else c.fade.box(t, y - h / 2, z, w, h, 0.02, color)
    t += w + 0.25 + c.rand() * 0.6
  }
}

function bunting(c: Ctx, lx0: number, lx1: number, ly: number, lz: number, sag: number, alongZ = false): void {
  const [x0, x1, y, z] = span(c, lx0, lx1, ly, lz, alongZ)
  placed(c, () => buntingRun(c, x0, x1, y, z, sag, alongZ))
}

function buntingRun(c: Ctx, x0: number, x1: number, y: number, z: number, sag: number, alongZ: boolean): void {
  const n = Math.floor(Math.abs(x1 - x0) / 0.45)
  const colors = [PAL.tissu1, PAL.tissu2, PAL.tissu3, PAL.blanc]
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const t = x0 + (x1 - x0) * u
    const yy = y - Math.sin(u * Math.PI) * sag
    const color = colors[i % colors.length]!
    const m = new THREE.Matrix4().compose(
      alongZ ? new THREE.Vector3(z, yy - 0.12, t) : new THREE.Vector3(t, yy - 0.12, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, alongZ ? Math.PI / 2 : 0, Math.PI / 4)),
      new THREE.Vector3(0.2, 0.2, 0.015),
    )
    c.fade.add(boxGeo, m, color)
  }
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1)

function trouvailles(c: Ctx, x: number, y: number, z: number, n: number, spread: number, alongZ: boolean): void {
  rigid(c, x, y, z, () => {
    for (let i = 0; i < n; i++) {
      const t = (i / Math.max(1, n - 1) - 0.5) * spread
      const px = alongZ ? x : x + t
      const pz = alongZ ? z + t : z
      const k = i % 6
      if (k === 0) {
        c.b.cyl(px, y + 0.14, pz, 0.015, 0.28, PAL.boisOmbre)
        c.b.add(coneGeo, new THREE.Matrix4().compose(new THREE.Vector3(px, y + 0.3, pz), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.1, 0.16)), PAL.tissu1)
      } else if (k === 1) {
        c.b.cyl(px, y + 0.1, pz, 0.045, 0.2, PAL.clair)
        c.b.cyl(px, y + 0.23, pz, 0.018, 0.07, PAL.clair)
      } else if (k === 2) {
        c.b.box(px, y + 0.05, pz, 0.12, 0.1, 0.22, PAL.tissu3)
      } else if (k === 3) {
        c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(px, y + 0.08, pz), new THREE.Quaternion(), new THREE.Vector3(0.07, 0.07, 0.07)), PAL.laiton)
      } else if (k === 4) {
        c.b.sphere(px, y + 0.07, pz, 0.07, 0.07, 0.07, PAL.tissu2)
      } else {
        c.b.box(px, y + 0.09, pz, 0.16, 0.18, 0.03, PAL.blanc)
      }
    }
  })
}
const coneGeo = new THREE.ConeGeometry(1, 1, 10)
const torusGeo = new THREE.TorusGeometry(1, 0.3, 6, 12)
const sphereLow = new THREE.SphereGeometry(1, 9, 6)
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 8)
const tailGeo = new THREE.TorusGeometry(0.75, 0.12, 5, 12, Math.PI * 1.1)

function breadOven(c: Ctx, x: number, z: number): void {
  rigid(c, x, 0, z, () => {
    const brick = new THREE.Color(0x9a5a48)
    c.b.with(SURF.stone, () => {
      c.b.rbox(x, 0.45, z, 0.95, 0.9, 0.85, brick.clone().multiplyScalar(0.8), 0.04)
      c.b.add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().compose(new THREE.Vector3(x, 0.9, z), new THREE.Quaternion(), new THREE.Vector3(0.47, 0.5, 0.42)), brick)
    })
    const toCam = new THREE.Vector3(-0.5, 0, 0.86).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), toCam)
    const mouth = new THREE.Vector3(x, 0.92, z).addScaledVector(toCam, 0.43)
    c.e.add(new THREE.CircleGeometry(0.2, 14, 0, Math.PI), new THREE.Matrix4().compose(mouth, q, new THREE.Vector3(1, 1.1, 1)), new THREE.Color(1.0, 0.62, 0.37))
    c.e.add(new THREE.CircleGeometry(0.12, 12, 0, Math.PI), new THREE.Matrix4().compose(mouth.clone().addScaledVector(toCam, 0.005), q, new THREE.Vector3(1, 0.8, 1)), new THREE.Color(1.0, 0.85, 0.55))
    c.b.add(new THREE.TorusGeometry(0.22, 0.035, 5, 14, Math.PI), new THREE.Matrix4().compose(mouth.clone().addScaledVector(toCam, -0.01), q, new THREE.Vector3(1, 1.1, 1)), new THREE.Color(0x4a3a3e))
    c.b.cyl(x + 0.1, 1.6, z - 0.1, 0.07, 0.6, PAL.metalSombre)
    c.b.rbox(x + 0.35, 0.94, z + 0.45, 0.5, 0.03, 0.22, PAL.boisOmbre, 0.01, -0.5)
    for (let i = 0; i < 2; i++) c.b.sphere(x + 0.3 + i * 0.15, 0.99, z + 0.45 - i * 0.08, 0.09, 0.05, 0.07, soft(PAL.pain, 0.7, 0.95))
    lamp(c, mouth.x + toCam.x * 0.3, 0.95, mouth.z + toCam.z * 0.3, 0, 0xff9e5e, 3.2, undefined, { hidden: true })
    col(c, 'prop', x, 0.6, z, 0.48, 0.6, 0.43)
  })
}

function boots(c: Ctx, x: number, z: number, yaw: number): void {
  rigid(c, x, 0, z, () => {
    const leather = new THREE.Color(0x6a4636)
    const wet = new THREE.Color(0x4a3236)
    for (const s of [-1, 1]) {
      const ox = x + Math.cos(yaw) * s * 0.09
      const oz = z - Math.sin(yaw) * s * 0.09
      c.b.add(UNIT_CYL, new THREE.Matrix4().compose(new THREE.Vector3(ox, 0.17, oz), new THREE.Quaternion().setFromEuler(new THREE.Euler(s * 0.06, 0, 0)), new THREE.Vector3(0.055, 0.26, 0.06)), s > 0 ? wet : leather)
      c.b.add(sphereLow, new THREE.Matrix4().compose(new THREE.Vector3(ox - Math.sin(yaw) * 0.06, 0.045, oz - Math.cos(yaw) * 0.06), new THREE.Quaternion().setFromAxisAngle(UPV, yaw), new THREE.Vector3(0.06, 0.045, 0.12)), s > 0 ? wet : leather)
      c.b.add(UNIT_CYL, new THREE.Matrix4().compose(new THREE.Vector3(ox, 0.29, oz), new THREE.Quaternion(), new THREE.Vector3(0.064, 0.035, 0.068)), new THREE.Color(0x8a6448))
    }
  })
}

function calendar(c: Ctx, x: number, y: number, z: number): void {
  rigid(c, x, y, z, () => {
    c.b.cyl(x - 0.01, y + 0.24, z, 0.008, 0.03, PAL.laiton, 'x')
    c.b.box(x - 0.012, y, z, 0.012, 0.44, 0.32, soft(PAL.creme, 0.6, 0.95))
    c.b.box(x - 0.02, y + 0.17, z, 0.006, 0.09, 0.32, soft(PAL.tissu1, 0.6, 0.8))
    for (let i = 0; i < 20; i++) {
      const r = Math.floor(i / 5)
      const k = i % 5
      const py = y + 0.08 - r * 0.075
      const pz = z - 0.12 + k * 0.06
      const crossed = i < 13
      if (!crossed) c.b.box(x - 0.02, py, pz, 0.004, 0.008, 0.03, PAL.interieurOmbre)
      else for (const a of [0.75, -0.75]) c.b.add(boxGeo, new THREE.Matrix4().compose(new THREE.Vector3(x - 0.02, py, pz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a), new THREE.Vector3(0.004, 0.045, 0.007)), soft(PAL.tissu1, 0.7, 0.85))
    }
  })
}

function scrubber(c: Ctx, x: number, y: number, z: number): void {
  rigid(c, x, y, z, () => {
    c.b.cyl(x, y, z, 0.02, 1.0, PAL.bois)
    c.b.cyl(x, y + 0.55, z, 0.11, 0.08, PAL.laiton)
    c.b.cyl(x, y + 0.62, z, 0.1, 0.06, PAL.tissu2)
  })
}

function ladder(c: Ctx, id: string, lx: number, lz: number, ly0: number, ly1: number, nx: number, nz: number, rooms: LadderDef['rooms']): void {
  const { x, y: y0, z } = at(c, lx, ly0, lz)
  const y1 = at(c, lx, ly1, lz).y
  placed(c, () => {
    const alongZ = Math.abs(nx) > 0.5
    const w = 0.5
    const h = y1 - y0
    for (const s of [-1, 1]) {
      if (alongZ) c.b.box(x, y0 + h / 2, z + (s * w) / 2, 0.05, h, 0.05, PAL.metal)
      else c.b.box(x + (s * w) / 2, y0 + h / 2, z, 0.05, h, 0.05, PAL.metal)
    }
    for (let y = y0 + 0.3; y < y1; y += 0.3) {
      if (alongZ) c.b.cyl(x, y, z, 0.02, w, PAL.laiton, 'z')
      else c.b.cyl(x, y, z, 0.02, w, PAL.laiton, 'x')
    }
    c.out.colliders.push({ part: c.part, kind: 'ladder', climbable: true, ownerId: id, x, y: y0 + h / 2, z, hx: alongZ ? 0.04 : w / 2, hy: h / 2, hz: alongZ ? w / 2 : 0.04 })
    c.out.ladders.push({ id, rooms, part: c.part, bottom: { x, y: y0, z }, top: { x, y: y1, z }, normal: { x: nx, y: 0, z: nz } })
  })
}

function sas(c: Ctx): void {
  c.b.box(2.84, 1.65, 65.3, 0.06, 0.9, 1.45, PAL.bois)
  c.out.decals.push(put(c, { kind: 'board', x: 2.8, y: 1.65, z: 65.3, w: 1.3, h: 0.75, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) }))
  stool(c, 2.1, 66.6, 0.5, PAL.tissu1)
  col(c, 'seat', 2.1, 0.25, 66.6, 0.2, 0.25, 0.2, 'tabouret-rouille')
  c.out.seats.push(put(c, { id: 'tabouret-rouille', x: 2.1, y: 0.5, z: 66.6, yaw: YAW_W }))
  rigid(c, -2.55, 0, 67.75, () => {
    c.b.box(-2.55, 0.42, 67.75, 0.45, 0.06, 2.9, PAL.bois)
    for (const z of [66.4, 67.75, 69.1]) c.b.box(-2.55, 0.2, z, 0.4, 0.4, 0.06, PAL.boisOmbre)
    col(c, 'seat', -2.55, 0.23, 67.75, 0.22, 0.23, 1.45, 'banc-sas')
    c.out.seats.push(put(c, { id: 'banc-sas', x: -2.55, y: 0.45, z: 67.4, yaw: YAW_E }))
  })
  for (const z of [66.6, 67.4, 68.2, 69.0]) {
    c.b.cyl(-2.76, 1.75, z, 0.03, 0.08, PAL.laiton, 'x')
    scrubber(c, -2.68, 1.35, z)
  }
  rigid(c, 2.0, 0, 63.55, () => {
    c.b.box(2.0, 1.85, 63.55, 1.4, 0.04, 0.3, PAL.bois)
    for (const x of [1.5, 2.0, 2.5]) c.b.sphere(x, 2.0, 63.55, 0.14, 0.15, 0.14, PAL.laiton)
  })
  rigid(c, 1.9, 0, 69.2, () => {
    c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.9, 0.12, 69.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.3, 0.3, 0.3)), PAL.corde)
    c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.9, 0.2, 69.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.24, 0.24, 0.3)), PAL.corde)
  })
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.0, 1.35, 69.76), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.16, 0.16)), PAL.tissu1)
  pipe(c, 63.4, 69.8, 2.55, 1.6, 0.06, PAL.metal, true)
  pipe(c, 63.4, 69.8, 2.62, 1.85, 0.04, PAL.laiton, true)
  const plate = at(c, 0, 0.01, 66.6)
  placed(c, () => c.b.box(plate.x, plate.y, plate.z, 1.6 * QUARTER_SCALE, 0.02, 3.6 * QUARTER_SCALE, PAL.metalSombre))
  ladder(c, 'echelle-sas', -2.72, 64.6, 0, 6.0, 1, 0, ['sas', 'echelle-toit'])
  lamp(c, 0.4, 2.35, 66.4, 0.35)
  lamp(c, -1.2, 2.4, 68.8, 0.25, PAL.lampeChaude, 4)
  spot(c, 'rouille-tabouret', 2.1, 0, 66.6, YAW_W)
  spot(c, 'rouille-tableau', 2.15, 0, 65.3, YAW_E)
}

function sasChambre(c: Ctx): void {
  for (const x of [-1.32, 1.32]) {
    c.b.cyl(x, 1.0, 72.6, 0.18, 1.6, PAL.metalSombre)
    c.b.cyl(x, 1.85, 72.6, 0.12, 0.2, PAL.laiton)
  }
  pipe(c, -1.4, 1.4, 2.6, 72.0, 0.07, PAL.metal)
  for (let i = 0; i < 5; i++) c.b.box(0, 0.01, 70.6 + i * 0.6, 3.0, 0.02, 0.06, PAL.laiton)
  lamp(c, -1.2, 2.45, 71.4, 0.0, PAL.froid, 3, 'sas')
  lamp(c, 1.2, 2.45, 72.8, 0.0, PAL.froid, 3, 'sas')
  spot(c, 'chambre-sas', 0, 0, 71.75, YAW_S)
}

function echelleToit(c: Ctx): void {
  lamp(c, -2.0, 5.6, 64.3, 0, PAL.froid, 2.5, 'echelle-toit')
  c.b.box(-1.86, 4.4, 64.6, 0.04, 0.5, 0.5, PAL.laiton)
}

function coursive(c: Ctx): void {
  pipe(c, -13.8, 9.8, 2.15, 61.2, 0.07, PAL.metal)
  pipe(c, -13.8, 9.8, 2.28, 61.45, 0.045, PAL.laiton)
  pipe(c, -13.8, 9.8, 0.25, 62.95, 0.05, PAL.metalSombre)
  laundry(c, -12.5, -8, 2.0, 62.0)
  laundry(c, -4.5, -1.5, 2.0, 62.0)
  rug(c, -2, 62, 22, 0.9, PAL.tissu1, PAL.tissu2)
  plantPot(c, 9.3, 0, 61.4, 0.8)
  crate(c, 4.2, 61.3, 0.5, 2)
  crate(c, 4.8, 61.3, 0.4, 1)
  barrel(c, 7.6, 62.75, 0.25, 0.7)
  barrel(c, -12.0, 61.3, 0.25, 0.7)
  for (const x of [-11, -5, 1, 7]) lamp(c, x, 2.45, 62.0, 0.35)
  spot(c, 'coursive-a', -11, 0, 62, YAW_E)
  spot(c, 'coursive-b', 8, 0, 62, YAW_W)
}

function cabine(c: Ctx): void {
  bunk(c, -5.65, 65.65, 0.9, 2.55, 0xc9644e)
  col(c, 'seat', -5.65, 0.28, 65.65, 0.45, 0.28, 1.27, 'couchette-cabine')
  c.out.seats.push(put(c, { id: 'couchette-cabine', x: -5.65, y: 0.56, z: 65.65, yaw: YAW_S, lying: true }))
  c.out.decals.push(put(c, { kind: 'drawings', x: -5.22, y: 1.45, z: 65.6, w: 1.8, h: 0.9, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) }))
  rigid(c, -8.45, 0, 64.3, () => {
    table(c, -8.45, 64.3, 0.6, 1.0, 0.75)
    col(c, 'prop', -8.45, 0.38, 64.3, 0.3, 0.38, 0.5)
    stool(c, -7.85, 64.4)
    c.b.box(-8.45, 0.8, 64.0, 0.25, 0.04, 0.18, PAL.blanc)
    c.b.cyl(-8.35, 0.84, 64.6, 0.04, 0.09, PAL.tissu3)
    c.b.box(-8.75, 1.6, 65.6, 0.25, 0.04, 1.4, PAL.bois)
    trouvailles(c, -8.72, 1.62, 65.6, 5, 1.2, true)
    scrubber(c, -7.95, 0.62, 67.05)
    c.b.cyl(-7.95, 1.3, 67.12, 0.012, 0.1, PAL.laiton, 'z')
    c.b.sphere(-8.5, 0.82, 64.7, 0.07, 0.05, 0.07, PAL.laiton)
  })
  rug(c, -7.2, 65.4, 1.6, 2.2, PAL.tissu3, PAL.tissu2)
  c.fade.box(-5.24, 1.4, 67.0, 0.04, 0.7, 0.18, PAL.echarpe)
  rigid(c, -6.35, 0, 64.15, () => {
    boots(c, -6.35, 64.15, 0.3)
    c.b.add(sphereLow, new THREE.Matrix4().compose(new THREE.Vector3(-6.3, 0.004, 64.2), new THREE.Quaternion(), new THREE.Vector3(0.32, 0.002, 0.24)), new THREE.Color(0x5f8f94))
  })
  calendar(c, -5.235, 1.55, 63.85)
  rigid(c, -6.3, 0, 66.75, () => {
    stool(c, -6.3, 66.75, 0.45, 0x8a6a50)
    c.b.cyl(-6.3, 0.5, 66.7, 0.04, 0.09, soft(PAL.creme, 0.6, 0.95))
    c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(-6.255, 0.5, 66.7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.025, 0.025, 0.03)), soft(PAL.creme, 0.6, 0.9))
    c.b.cyl(-6.3, 0.548, 66.7, 0.034, 0.004, new THREE.Color(0x6a4a3a))
    c.b.rbox(-6.36, 0.475, 66.86, 0.16, 0.04, 0.12, soft(PAL.tissu3, 0.5, 0.8), 0.008, 0.3)
  })
  rigid(c, -8.4, 0, 66.7, () => {
    c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(-8.4, 0.06, 66.7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.16, 0.16, 0.2)), PAL.corde)
    c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(-8.4, 0.13, 66.7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.12, 0.12, 0.2)), PAL.corde)
  })
  c.b.box(-8.79, 1.45, 64.15, 0.02, 0.4, 0.3, PAL.creme)
  for (let i = 0; i < 9; i++) c.b.box(-8.775, 1.52 - Math.floor(i / 3) * 0.08, 64.07 + (i % 3) * 0.08, 0.01, 0.012, 0.05, PAL.tissu1)
  rigid(c, -6.9, 2.95, 64.6, () => {
    c.fade.cyl(-6.9, 2.95, 64.6, 0.005, 0.4, PAL.corde)
    c.fade.cyl(-6.9, 2.75, 64.6, 0.006, 0.5, PAL.boisOmbre, 'x')
    for (let i = 0; i < 3; i++) {
      const fx = -7.1 + i * 0.2
      const drop = 0.12 + (i % 2) * 0.1
      c.fade.cyl(fx, 2.75 - drop / 2, 64.6, 0.004, drop, PAL.corde)
      const fy = 2.72 - drop
      c.fade.sphere(fx, fy, 64.6, 0.075, 0.042, 0.022, [PAL.tissu1, PAL.clair, PAL.tissu2][i]!)
      c.fade.add(coneGeo, new THREE.Matrix4().compose(new THREE.Vector3(fx + 0.085, fy, 64.6), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), new THREE.Vector3(0.035, 0.05, 0.012)), [PAL.tissu1, PAL.clair, PAL.tissu2][i]!)
    }
  })
  rigid(c, -8.7, 1.7, 65.1, () => {
    c.b.cyl(-8.7, 1.71, 65.1, 0.05, 0.14, PAL.clair)
    for (let i = 0; i < 5; i++) c.b.sphere(-8.7 + (i % 2) * 0.02, 1.66 + i * 0.02, 65.1, 0.02, 0.015, 0.02, [PAL.clair, PAL.vertDoux, PAL.blanc][i % 3]!)
  })
  lamp(c, -7, 2.55, 65.4, 0.3, PAL.lampe, 4.5, undefined, { night: true })
  c.b.cyl(-5.3, 1.75, 66.9, 0.03, 0.12, PAL.laiton, 'x')
  c.b.add(new THREE.ConeGeometry(0.11, 0.12, 12, 1, true), new THREE.Matrix4().makeTranslation(-5.42, 1.98, 66.9), soft(PAL.tissu2, 0.6, 0.9))
  lamp(c, -5.45, 1.9, 66.9, 0.0, PAL.lampeChaude, 2.6, undefined, { hidden: true })
  c.e.sphere(-5.42, 1.91, 66.9, 0.045, 0.045, 0.045, new THREE.Color(1, 0.78, 0.5))
  spot(c, 'cabine-centre', -7, 0, 65.4, YAW_S)
}

function voisins(c: Ctx): void {
  c.fade.box(-6.0, 1.15, 57.5, 0.03, 2.1, 2.2, PAL.tissu3)
  col(c, 'prop', -6.0, 1.0, 57.5, 0.05, 1.0, 1.1)
  bunk(c, -7.75, 55.65, 2.2, 0.9, PAL.tissu2)
  bunk(c, -6.55, 55.65, 2.2, 0.9, PAL.tissu1)
  col(c, 'prop', -7.75, 0.28, 55.65, 1.1, 0.28, 0.45)
  col(c, 'prop', -6.55, 0.28, 55.65, 1.1, 0.28, 0.45)
  rigid(c, -4.4, 0, 57.9, () => {
    table(c, -4.4, 57.9, 0.9, 0.7, 0.72)
    col(c, 'prop', -4.4, 0.36, 57.9, 0.45, 0.36, 0.35)
    stool(c, -3.75, 57.9)
    for (const x of [-4.6, -4.2]) c.b.cyl(x, 0.77, 57.8, 0.05, 0.1, PAL.blanc)
  })
  laundry(c, -8.6, -6.4, 1.9, 59.6)
  barrel(c, -8.5, 60.2, 0.25, 0.6)
  rug(c, -6, 59.7, 2.4, 1.2, PAL.tissu2, PAL.tissu1)
  lamp(c, -7.5, 2.35, 57.6, 0.3)
  lamp(c, -4.5, 2.35, 57.6, 0.3)
  spot(c, 'voisin-lit-a', -7.65, 0.56, 55.65, YAW_W)
  spot(c, 'voisin-lit-b', -6.45, 0.56, 55.65, YAW_W)
  spot(c, 'voisin-table', -3.75, 0, 57.9, YAW_W)
  spot(c, 'voisin-debout', -7.5, 0, 59.2, YAW_S)
}

const BENCH_ROWS = [59.2, 61.8, 64.4, 67.0]
const BENCH_HALVES: readonly [number, number][] = [[11.8, 17.2], [18.8, 24.4]]

function refectoire(c: Ctx): void {
  const rows = BENCH_ROWS.map((z) => mapZ(c.part, z))
  const halves = BENCH_HALVES.map(([a, b]) => [mapX(c.part, a), mapX(c.part, b)] as const)
  const ilo = at(c, 19.2, 0.47, 67.0)
  const R = REBORD
  placed(c, () => {
    for (const z of rows) {
      for (const [x0, x1] of halves) {
        const xm = (x0 + x1) / 2
        const len = x1 - x0
        c.b.box(xm, 0.43, z, len, 0.07, 0.38, PAL.bois)
        for (let x = x0 + 0.2; x <= x1 - 0.19; x += (len - 0.4) / Math.ceil((len - 0.4) / 2.2)) c.b.box(x, 0.2, z, 0.08, 0.4, 0.3, PAL.boisOmbre)
        table(c, xm, z + 0.65, len, 0.5, 0.74)
        for (const k of [-1, 0, 1]) c.b.box(xm + (k * len) / 4, 0.35, z + 0.65, 0.07, 0.68, 0.07, PAL.boisOmbre)
        col(c, 'prop', xm, 0.37, z + 0.35, len / 2, 0.37, 0.55)
        for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.72) {
          c.out.benchSeats.push(put(c, { x, y: 0.47, z, yaw: YAW_S }))
          c.b.cyl(x, 0.765, z + 0.6, 0.085, 0.05, c.rand() > 0.5 ? PAL.blanc : PAL.bleuDoux)
          c.b.cyl(x, 0.79, z + 0.6, 0.06, 0.02, PAL.poisson)
          if (c.rand() > 0.5) c.b.cyl(x + 0.18, 0.79, z + 0.72, 0.04, 0.1, PAL.tissu2)
        }
      }
    }
    c.b.box(ilo.x, 0.5, ilo.z, 0.42, 0.06, 0.36, PAL.tissu1)
    col(c, 'seat', ilo.x, 0.5, ilo.z, 0.21, 0.08, 0.18, 'siege-ilo')
    c.out.seats.push(put(c, { id: 'siege-ilo', ...ilo, yaw: YAW_S }))
    c.out.benchSeats = c.out.benchSeats.filter((s) => Math.hypot(s.x - ilo.x, s.z - ilo.z) > 0.3)

    c.b.box((R.x0 + R.x1) / 2, R.top / 2, (R.stepZ + R.z1) / 2, R.x1 - R.x0, R.top, R.z1 - R.stepZ, PAL.boisClair)
    c.b.box((R.x0 + R.x1) / 2, 0.15, (R.z0 + R.stepZ) / 2, R.x1 - R.x0 - 1.6, 0.3, R.stepZ - R.z0, PAL.bois)
    col(c, 'interior', (R.x0 + R.x1) / 2, R.top / 2, (R.stepZ + R.z1) / 2, (R.x1 - R.x0) / 2, R.top / 2, (R.z1 - R.stepZ) / 2)
    col(c, 'stair', (R.x0 + R.x1) / 2, 0.15, (R.z0 + R.stepZ) / 2, (R.x1 - R.x0 - 1.6) / 2, 0.15, (R.stepZ - R.z0) / 2)
    c.b.with(SURF.fabric, () => {
      for (const [lx, color] of [[14.6, PAL.tissu1], [16.4, PAL.tissu2], [19.8, PAL.tissu3], [21.6, PAL.tissu1]] as const) {
        const x = mapX(c.part, lx)
        c.b.rbox(x, R.top + 0.06, R.z1 - 0.9, 1.0, 0.12, 0.7, soft(color, 0.65, 0.92), 0.05)
        c.b.rbox(x + 0.25, R.top + 0.17, R.z1 - 0.45, 0.42, 0.16, 0.18, soft(PAL.creme, 0.6, 0.9), 0.06, 0.15)
      }
    })
    c.b.with(SURF.brass, () => c.b.box((R.x0 + R.x1) / 2, R.top - 0.02, R.stepZ + 0.01, R.x1 - R.x0, 0.04, 0.04, PAL.laiton))
    for (let i = 0; i < 13; i++) {
      const x = R.x0 + 0.7 + i * ((R.x1 - R.x0 - 1.4) / 12)
      c.b.cyl(x, R.top + 0.03, R.stepZ + 0.12, 0.05, 0.05, PAL.laiton)
      c.e.sphere(x, R.top + 0.1, R.stepZ + 0.12, 0.045, 0.06, 0.045, new THREE.Color(1.0, 0.72, 0.4))
      c.b.cyl(x, R.top + 0.17, R.stepZ + 0.12, 0.03, 0.025, PAL.laiton)
    }
    for (const x of [R.x0 + 0.4, R.x1 - 0.4]) {
      c.b.box(x, 1.6, R.z1 - 1.2, 0.7, 2.0, 0.08, PAL.bois)
      for (const y of [1.1, 1.6, 2.1]) {
        c.b.box(x, R.top + y - 0.6, R.z1 - 1.4, 0.7, 0.04, 0.4, PAL.bois)
        trouvailles(c, x, R.top + y - 0.58, R.z1 - 1.35, 3, 0.45, false)
      }
      col(c, 'prop', x, 1.6, R.z1 - 1.35, 0.35, 1.0, 0.25)
    }
  })
  lamp(c, 18, 3.4, 70.2, 0.9, PAL.lampe, 5.5)
  lamp(c, 18, 1.0, 69.6, 0, PAL.lampeChaude, 3.2, undefined, { hidden: true })
  c.out.seats.push(put(c, { id: 'banc-rebord', x: 18, y: R.top + 0.05, z: 70.9, yaw: YAW_S }))
  for (const [x, z] of [[13.2, 65.0], [20.5, 62.4], [22.4, 67.6], [15.6, 60.0]] as const) c.out.steam.push(put(c, { x, y: 0.82, z }))
  rigid(c, 15.5, 0, 57.35, () => {
    c.b.box(15.5, 0.5, 57.35, 2.6, 1.0, 0.7, PAL.bois)
    c.b.box(15.5, 1.02, 57.35, 2.7, 0.05, 0.8, PAL.boisClair)
    col(c, 'prop', 15.5, 0.5, 57.35, 1.3, 0.5, 0.35, 'comptoir')
    c.b.with(SURF.fabric, () => {
      c.b.cyl(14.9, 1.09, 57.3, 0.3, 0.1, soft(0xb08a5a, 0.7, 0.9))
      c.b.cyl(14.9, 1.14, 57.3, 0.32, 0.03, soft(0x8a6448, 0.7, 0.9))
    })
    for (let i = 0; i < 4; i++) c.b.sphere(14.7 + (i % 2) * 0.3, 1.2 + Math.floor(i / 2) * 0.05, 57.2 + Math.floor(i / 2) * 0.18, 0.14, 0.08, 0.1, soft(PAL.pain, 0.7, 0.95))
    copperPot(c, c.b, 16.5, 1.045, 57.4, 0.26, 0.34)
    c.out.steam.push(put(c, { x: 16.5, y: 1.4, z: 57.4 }))
    for (let i = 0; i < 6; i++) c.b.cyl(17.3 + (i % 3) * 0.16, 1.07 + Math.floor(i / 3) * 0.05, 57.25, 0.07, 0.04, soft(i % 2 ? PAL.blanc : PAL.bleuDoux, 0.7, 0.92))
  })
  c.b.with(SURF.planksX, () => c.b.rbox(17.6, 1.75, 56.24, 0.86, 1.12, 0.05, PAL.boisOmbre, 0.02))
  c.out.decals.push(put(c, { kind: 'menu', x: 17.6, y: 1.75, z: 56.27, w: 0.74, h: 0.98, normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) }))
  plantPot(c, 11.0, 0, 70.9, 1.2)
  plantPot(c, 25.0, 0, 70.9, 1.25)
  tallPlant(c, 12.2, 71.2, 1.0)
  tallPlant(c, 23.9, 71.3, 1.15)
  plantPot(c, 12.9, R.top, 71.5, 0.8)
  plantPot(c, 23.1, R.top, 71.5, 0.75)
  c.b.with(SURF.planksX, () => c.b.rbox(11.15, 1.95, 71.93, 1.1, 1.38, 0.06, PAL.boisOmbre, 0.025))
  c.out.decals.push(put(c, { kind: 'menu', x: 11.15, y: 1.95, z: 71.89, w: 0.94, h: 1.22, normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) }))
  c.b.box(11.15, 1.24, 71.86, 0.9, 0.03, 0.08, PAL.boisOmbre)
  for (let i = 0; i < 3; i++) c.b.box(10.9 + i * 0.12, 1.27, 71.85, 0.07, 0.018, 0.018, PAL.blanc)
  lamp(c, 11.2, 2.95, 71.3, 0.3, PAL.lampe, 3.0)
  for (const [y, w] of [[1.3, 1.0], [1.85, 1.0]] as const) {
    c.b.with(SURF.planksX, () => c.b.rbox(24.85, y, 71.75, w, 0.04, 0.32, PAL.bois, 0.01))
    jarRow(c, 24.45, 25.25, y + 0.02, 71.75)
  }
  lamp(c, 24.8, 2.95, 71.2, 0.3, PAL.lampe, 3.0)
  plantPot(c, 24.9, 0, 64.0, 0.9)
  bunting(c, 10.4, 25.6, 6.6, 60.5, 0.6)
  bunting(c, 10.4, 25.6, 6.4, 66.5, 0.5)
  bunting(c, 59.5, 68.5, 6.5, 18, 0.4, true)
  for (const x of [13, 18, 23]) for (const z of [59.5, 63.25, 67]) lamp(c, x, 5.4, z, 1.3, PAL.lampe, 9.5)
  barrel(c, 25.4, 57.4, 0.3, 0.8)
  barrel(c, 24.8, 57.2, 0.25, 0.6)
  c.b.cyl(10.6, 0.4, 57, 0.18, 0.8, PAL.tissu3)
  c.b.cyl(10.6, 1.1, 57, 0.08, 0.6, PAL.revetement)

  spot(c, 'cuistot-comptoir', 15.5, 0, 56.6, YAW_S)
  spot(c, 'cuistot-allee', 18, 0, 66.2, YAW_S)
  spot(c, 'rebord-mila', 17.1, R.top, 70.5, YAW_E + 0.4)
  spot(c, 'rebord-tao', 17.9, R.top, 70.5, YAW_W - 0.4)
  spot(c, 'rebord-pepin', 17.5, R.top, 71.2, YAW_N)
  spot(c, 'grand-pere-refectoire', 12.2, 0.47, BENCH_ROWS[3]!, YAW_S)
}

function cuisine(c: Ctx): void {
  const iron = new THREE.Color(0x3e3a46)
  const iron2 = new THREE.Color(0x52505e)
  rigid(c, 16.6, 0, 49.0, () => {
    c.b.with(SURF.steel, () => {
      c.b.rbox(16.6, 0.47, 49.0, 2.0, 0.82, 1.2, iron, 0.05)
      c.b.rbox(16.6, 0.92, 49.0, 2.12, 0.07, 1.3, iron2, 0.025)
    })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.b.cyl(16.6 + sx * 0.9, 0.05, 49.0 + sz * 0.5, 0.06, 0.1, iron)
    c.b.with(SURF.brass, () => {
      c.b.cyl(16.6, 0.8, 49.7, 0.025, 2.1, PAL.laiton, 'x')
      for (const x of [15.6, 17.6]) c.b.box(x, 0.8, 49.66, 0.04, 0.05, 0.08, PAL.laiton)
      c.b.box(16.6, 0.12, 49.61, 2.0, 0.05, 0.02, new THREE.Color(PAL.laiton).multiplyScalar(0.8))
    })
    for (const x of [16.05, 17.15]) {
      c.b.rbox(x, 0.42, 49.61, 0.62, 0.42, 0.04, iron2, 0.02)
      c.e.box(x, 0.4, 49.635, 0.46, 0.26, 0.01, new THREE.Color(1.0, 0.55, 0.22))
      for (let i = 0; i < 5; i++) c.b.box(x - 0.2 + i * 0.1, 0.4, 49.645, 0.02, 0.28, 0.01, iron)
      c.b.sphere(x + 0.24, 0.42, 49.66, 0.025, 0.025, 0.025, PAL.laiton)
    }
    c.e.box(16.6, 0.962, 49.0, 0.5, 0.006, 0.5, new THREE.Color(0.9, 0.38, 0.16))
    c.b.cyl(17.3, 2.6, 48.7, 0.12, 3.4, iron)
    for (const y of [1.4, 2.4, 3.4]) c.b.cyl(17.3, y, 48.7, 0.14, 0.05, PAL.laiton)
    for (const [y, sx, sy, k] of [[2.2, 1.25, 0.95, 0.62], [2.55, 0.95, 0.85, 0.5], [2.9, 0.62, 0.7, 0.4], [3.25, 0.4, 0.55, 0.32]] as const) {
      c.b.sphere(17.0 + (y - 2.2) * 0.25, y, 48.2 + (y - 2.2) * 0.012, sx, sy, 0.01, new THREE.Color(0x8a7470).multiplyScalar(k * 1.25))
    }
    c.b.rbox(15.58, 0.45, 49.0, 0.04, 0.5, 0.7, iron2, 0.015)
    c.e.box(15.555, 0.43, 49.0, 0.01, 0.34, 0.52, new THREE.Color(1.0, 0.62, 0.37))
    c.e.box(15.55, 0.36, 49.0, 0.01, 0.12, 0.44, new THREE.Color(1.0, 0.82, 0.5))
    for (let i = 0; i < 5; i++) c.b.box(15.54, 0.43, 48.8 + i * 0.1, 0.012, 0.36, 0.02, iron)
    c.b.add(new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4().compose(new THREE.Vector3(15.33, 0.45, 48.55), new THREE.Quaternion().setFromAxisAngle(UPV, -1.1), new THREE.Vector3(0.04, 0.48, 0.62)), iron2)
    c.e.sphere(15.1, 0.006, 49.0, 0.55, 0.002, 0.4, new THREE.Color(0.55, 0.26, 0.12))
    for (let i = 0; i < 4; i++) c.e.sphere(15.62 + c.rand() * 0.04, 0.24 + c.rand() * 0.1, 48.82 + c.rand() * 0.35, 0.012, 0.012, 0.012, new THREE.Color(1, 0.8, 0.4))
    col(c, 'prop', 16.6, 0.45, 49.0, 1.0, 0.45, 0.6)
    copperPot(c, c.b, 16.3, 0.95, 49.0, 0.34, 0.42)
    c.b.cyl(16.3, 1.39, 49.0, 0.3, 0.03, new THREE.Color(0xa86a42))
    c.b.sphere(16.3, 1.42, 49.0, 0.04, 0.03, 0.04, PAL.laiton)
    copperPot(c, c.b, 17.15, 0.95, 49.15, 0.16, 0.22)
    c.b.cyl(17.15, 1.2, 49.32, 0.015, 0.2, PAL.laiton, 'z')
    col(c, 'prop', 16.3, 1.18, 49.0, 0.36, 0.25, 0.36, 'marmite-drift')
    for (const [x, y, z] of [[16.3, 1.45, 49.0], [17.15, 1.2, 49.2], [16.1, 1.5, 48.85], [16.5, 1.5, 49.15], [15.9, 1.0, 49.4], [17.4, 1.0, 48.8], [16.8, 1.0, 49.45], [15.7, 0.75, 49.0]] as const) {
      c.out.steam.push(put(c, { x, y, z, big: true }))
    }
    lamp(c, 16.6, 0.42, 49.95, 0, PAL.lampeChaude, 4.2, undefined, { hidden: true })
    lamp(c, 15.3, 0.45, 49.1, 0, 0xff9e5e, 3.6, undefined, { hidden: true })
    breadOven(c, 14.95, 48.62)
  })

  rigid(c, 13.5, 0, 52.0, () => {
    table(c, 13.5, 52.0, 3.0, 1.2, 0.85)
    col(c, 'prop', 13.5, 0.43, 52.0, 1.5, 0.43, 0.6)
    c.b.with(SURF.fabric, () => c.b.box(13.5, 0.856, 52.0, 2.6, 0.006, 0.9, soft(PAL.toile, 0.6, 0.95)))
    for (let i = 0; i < 4; i++) c.b.sphere(12.3 + i * 0.4, 0.93, 51.75 + (i % 2) * 0.18, 0.15 + c.rand() * 0.04, 0.08, 0.11, soft(PAL.pain, 0.7, 0.92))
    c.b.with(SURF.fabric, () => c.b.rbox(12.5, 0.95, 52.35, 0.55, 0.14, 0.4, soft(0xc9a882, 0.6, 0.8), 0.06))
    for (let i = 0; i < 3; i++) {
      c.b.sphere(13.9 + i * 0.32, 0.9, 52.3, 0.14, 0.035, 0.05, soft(0x9fb0b8, 0.55, 0.9))
      c.b.add(coneGeo, new THREE.Matrix4().compose(new THREE.Vector3(14.06 + i * 0.32, 0.9, 52.3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), new THREE.Vector3(0.04, 0.06, 0.015)), soft(0x9fb0b8, 0.55, 0.8))
    }
    c.b.rbox(14.9, 0.875, 51.7, 0.42, 0.04, 0.3, new THREE.Color(PAL.boisClair).multiplyScalar(0.85), 0.01)
    c.b.rbox(15.0, 0.95, 52.4, 0.12, 0.16, 0.08, PAL.boisOmbre, 0.015)
    for (let i = 0; i < 3; i++) c.b.cyl(14.97 + i * 0.03, 1.05, 52.4, 0.012, 0.06, PAL.boisOmbre)
  })
  stool(c, 12.6, 53.0, 0.5, 0x8a6a50)
  stool(c, 14.3, 50.9, 0.5, 0x8a6a50)
  shelf(c, 12.6, 48.35, 4.0, [1.2, 1.7, 2.2], false)
  shelf(c, 10.35, 53.5, 3.0, [1.3, 1.8], true)

  rigid(c, 13.5, 2.45, 52.0, () => {
    c.fade.cyl(13.5, 2.45, 52.0, 0.035, 3.4, PAL.boisOmbre, 'x')
    for (const x of [12.0, 15.0]) c.fade.cyl(x, 3.2, 52.0, 0.01, 1.5, PAL.metalSombre)
    for (let i = 0; i < 5; i++) {
      const x = 12.1 + i * 0.7
      c.fade.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(x, 2.4, 52.0), new THREE.Quaternion(), new THREE.Vector3(0.035, 0.035, 0.035)), PAL.metalSombre)
      c.out.pendulums.push(put(c, { x, y: 2.37, z: 52.0, cord: 0.4, drop: 0.02, scale: 0.75 + (i % 3) * 0.18 }))
    }
    for (const x of [12.45, 13.85]) {
      c.fade.cyl(x, 2.12, 52.0, 0.01, 0.5, PAL.metal)
      c.fade.sphere(x, 1.86, 52.0, 0.05, 0.03, 0.05, PAL.metal)
    }
  })
  for (const [x, z] of [[10.75, 50.4], [10.75, 50.9], [10.75, 51.4]] as const) fishString(c, x, 2.6, z, 4, true)
  for (const [x, z] of [[10.75, 52.0], [10.75, 55.4]] as const) onionString(c, x, 2.55, z, 8)
  for (let i = 0; i < 3; i++) c.fade.cyl(17.6, 2.05, 51.2 + i * 0.35, 0.05, 0.4, soft(i === 1 ? PAL.revetement : PAL.laminaire, 0.65))

  rug(c, 16.4, 50.45, 1.9, 0.6, 0x8a5a44, 0xc9a15a)
  rigid(c, 17.5, 0, 53.3, () => {
    c.b.with(SURF.fabric, () => {
      c.b.sphere(17.5, 0.2, 53.3, 0.28, 0.22, 0.24, soft(0xb09a78, 0.7, 0.72))
      c.b.sphere(17.45, 0.16, 53.85, 0.24, 0.17, 0.22, soft(0xb09a78, 0.7, 0.66))
      c.b.cyl(17.5, 0.4, 53.3, 0.06, 0.06, PAL.corde)
    })
  })
  rug(c, 13.7, 53.75, 2.8, 1.1, 0x4f6d7a, 0x9a6a50)
  rigid(c, 15.55, 0, 53.75, () => {
    c.b.with(SURF.fabric, () => {
      c.b.cyl(15.55, 0.08, 53.75, 0.25, 0.16, soft(0xb08a5a, 0.7, 0.8))
      c.b.cyl(15.55, 0.15, 53.75, 0.2, 0.04, soft(PAL.tissu1, 0.5, 0.7))
    })
    cat(c, 15.55, 0.15, 53.75, 2.3)
  })
  rigid(c, 12.0, 0, 54.5, () => {
    c.b.with(SURF.fabric, () => c.b.cyl(12.0, 0.12, 54.5, 0.22, 0.24, soft(0x9a7650, 0.7, 0.8)))
    for (let i = 0; i < 4; i++) c.b.sphere(11.92 + (i % 2) * 0.16, 0.27, 54.42 + Math.floor(i / 2) * 0.16, 0.1, 0.035, 0.05, soft(0x9fb0b8, 0.55, 0.85))
  })
  rigid(c, 11.4, 0, 50.0, () => {
    c.b.cyl(11.4, 0.18, 50.0, 0.16, 0.36, PAL.metalSombre)
    c.b.cyl(11.4, 0.36, 50.0, 0.17, 0.03, PAL.metal)
    c.b.cyl(11.45, 0.75, 50.05, 0.015, 0.9, PAL.bois)
  })
  c.b.box(14.8, 0.013, 54.2, 0.4, 0.01, 0.4, new THREE.Color(0x4a4652))
  barrel(c, 17.4, 55.3, 0.3, 0.8)
  crate(c, 17.4, 54.4, 0.45, 2)
  rigid(c, 11.2, 0, 55.4, () => {
    c.b.box(11.2, 0.2, 55.4, 0.6, 0.4, 0.4, PAL.toile)
    for (let i = 0; i < 4; i++) c.b.sphere(11.05 + i * 0.1, 0.43, 55.4 + (i % 2) * 0.08, 0.06, 0.05, 0.06, soft(i % 2 ? 0xc08a50 : 0x8a5a6a, 0.7))
  })
  lamp(c, 12.5, 2.95, 52, 0.5)
  lamp(c, 16, 2.95, 52.5, 0.5)
  spot(c, 'cuistot-fourneau', 16.4, 0, 50.0, YAW_N)
  spot(c, 'cuistot-table', 13.5, 0, 53.0, YAW_N)
}

function passerelle(c: Ctx): void {
  const f = FOOTPRINTS[c.part]!
  placed(c, () => walkway(c, f.x0, f.x1, (f.z0 + f.z1) / 2))
}

function walkway(c: Ctx, x0: number, x1: number, z: number): void {
  for (const s of [-1.45, 1.45]) {
    c.b.cyl((x0 + x1) / 2, 0.95, z + s, 0.03, x1 - x0 - 0.4, PAL.laiton, 'x')
    for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.5) c.b.box(x, 0.48, z + s, 0.04, 0.95, 0.04, PAL.metalSombre)
  }
  c.b.box((x0 + x1) / 2, 0.01, z, x1 - x0 - 0.4, 0.02, 0.9, PAL.metalSombre)
  lamp(c, (x0 + x1) / 2, 3.2, z, 0.3, PAL.lampe, 4)
}

function marche(c: Ctx): void {
  const stall = (id: string, x: number, z: number, alongZ: boolean, color: number, goods: (cx: number, cz: number) => void, keeperYaw: number, keeperDx: number) => {
    rigid(c, x, 0, z, () => {
      const sx = alongZ ? 0.8 : 3.0
      const sz = alongZ ? 3.0 : 0.8
      c.b.box(x, 0.48, z, sx, 0.96, sz, PAL.bois)
      c.b.box(x, 0.98, z, sx + 0.1, 0.05, sz + 0.1, PAL.boisClair)
      col(c, 'prop', x, 0.48, z, sx / 2, 0.48, sz / 2, `etal-marche-ecluse-${id}`)
      const ax = alongZ ? x - keeperDx * 0.4 : x
      for (const s of [-1, 1]) {
        const px = alongZ ? ax : x + s * (sx / 2)
        const pz = alongZ ? z + s * (sz / 2) : z - keeperDx * 0.4
        c.b.box(px, 1.25, pz, 0.07, 2.5, 0.07, PAL.boisOmbre)
      }
      const stripes = 6
      for (let i = 0; i < stripes; i++) {
        const t = (i + 0.5) / stripes - 0.5
        const cc = i % 2 === 0 ? color : PAL.blanc
        if (alongZ) c.fade.box(ax + keeperDx * 0.35, 2.4, z + t * (sz + 0.4), 1.3, 0.04, (sz + 0.4) / stripes, cc)
        else c.fade.box(x + t * (sx + 0.4), 2.4, z - keeperDx * 0.35, (sx + 0.4) / stripes, 0.04, 1.3, cc)
      }
      goods(x, z)
      const kx = alongZ ? x - keeperDx : x
      const kz = alongZ ? z : z - keeperDx
      spot(c, `etal-${id}`, kx, 0, kz, keeperYaw)
    })
  }
  stall('poissons', -37.8, 58, true, PAL.tissu3, (x, z) => {
    for (let i = 0; i < 7; i++) c.b.sphere(x, 1.05, z - 1.2 + i * 0.4, 0.09, 0.06, 0.2, PAL.poisson)
  }, YAW_E, 1.6)
  stall('algues', -37.8, 63.5, true, PAL.revetement, (x, z) => {
    const cs = [PAL.revetement, PAL.tissu1, PAL.laminaire]
    for (let i = 0; i < 8; i++) c.b.cyl(x, 1.12, z - 1.2 + i * 0.34, 0.08, 0.22, cs[i % 3]!)
  }, YAW_E, 1.6)
  stall('trouvailles', -28.2, 66, true, PAL.tissu2, (x, z) => {
    trouvailles(c, x, 1.0, z, 8, 2.4, true)
  }, YAW_W, -1.6)
  stall('bric-a-brac', -33, 68.6, false, PAL.tissu1, (x, z) => {
    for (let i = 0; i < 5; i++) crateSmall(c, x - 1.1 + i * 0.55, 1.0, z)
  }, YAW_N, -0.8)
  c.b.box(-33, 0.42, 61.0, 2.4, 0.07, 0.4, PAL.bois)
  for (const x of [-34.0, -32.0]) c.b.box(x, 0.2, 61, 0.08, 0.4, 0.35, PAL.boisOmbre)
  col(c, 'seat', -33, 0.23, 61.0, 1.2, 0.23, 0.2, 'banc-marche')
  c.out.seats.push(put(c, { id: 'banc-marche', x: -33, y: 0.45, z: 61.0, yaw: YAW_S }))
  crate(c, -30.5, 57.0, 0.5, 2)
  crate(c, -30.0, 56.4, 0.45, 1)
  barrel(c, -35.5, 55.0, 0.3, 0.8)
  barrel(c, -34.8, 55.1, 0.25, 0.7)
  for (let i = 0; i < 4; i++) c.b.cyl(-31.5 + i * 0.6, 0.15, 64.0, 0.22, 0.3, PAL.laminaire)
  bunting(c, -37, -29, 5.4, 58, 0.5)
  bunting(c, -37, -29, 5.2, 65, 0.45)
  for (let i = 0; i < 6; i++) c.fade.box(-33 + (i - 2.5) * 1.6, 4.9, 61.5, 0.9, 0.9, 0.02, PAL.corde)
  for (const [x, z] of [[-36, 58], [-30, 58], [-36, 65], [-30, 65]] as const) lamp(c, x, 4.6, z, 1.1, PAL.lampe, 8.5)
  rug(c, -33, 62.5, 4, 3, PAL.tissu1, PAL.tissu3)
  spot(c, 'marche-banc', -33, 0.47, 61.0, YAW_S)
}

function crateSmall(c: Ctx, x: number, y: number, z: number): void {
  rigid(c, x, y, z, () => {
    c.b.box(x, y + 0.12, z, 0.4, 0.24, 0.35, c.rand() > 0.5 ? PAL.bois : PAL.boisClair)
    c.b.sphere(x, y + 0.27, z, 0.08, 0.05, 0.08, [PAL.tissu1, PAL.tissu2, PAL.clair][Math.floor(c.rand() * 3)]!)
  })
}

function salleDesCartes(c: Ctx): void {
  const top = 0.985
  const darkW = new THREE.Color(PAL.boisOmbre).multiplyScalar(1.2)
  const warm = new THREE.Color(PAL.bois).multiplyScalar(0.72)
  const brass = new THREE.Color(PAL.laiton)
  rigid(c, 40, 0, 61.2, () => {
    c.b.with(SURF.planksX, () => {
      c.b.rbox(40, top - 0.04, 61.2, 2.8, 0.08, 2.0, darkW, 0.03)
      for (const s of [-1, 1]) {
        c.b.rbox(40, top - 0.15, 61.2 + s * 0.88, 2.5, 0.14, 0.05, warm, 0.015)
        c.b.rbox(40 + s * 1.28, top - 0.15, 61.2, 0.05, 0.14, 1.7, warm, 0.015)
      }
      c.b.box(40, 0.2, 61.2, 2.4, 0.04, 1.6, warm)
    })
    for (let i = -1; i <= 1; i++) {
      c.b.rbox(40 + i * 0.75, top - 0.15, 60.3, 0.6, 0.11, 0.03, darkW, 0.012)
      c.b.sphere(40 + i * 0.75, top - 0.15, 60.28, 0.025, 0.025, 0.02, PAL.laiton)
    }
    for (const [dx, dz] of [[-1.25, -0.85], [1.25, -0.85], [-1.25, 0.85], [1.25, 0.85]] as const) turnedLeg(c, 40 + dx, 61.2 + dz, top - 0.08, darkW)
    for (let i = 0; i < 4; i++) c.b.cyl(39.3 + i * 0.45, 0.28, 61.1 + (i % 2) * 0.2, 0.05 + (i % 2) * 0.012, 0.8, soft(i % 2 ? 0xc9b48e : 0xb8a07a, 0.7, 0.72), 'z')
    col(c, 'prop', 40, 0.48, 61.2, 1.4, 0.48, 1.0, 'table-carte')
    c.out.decals.push(put(c, { kind: 'chart', x: 40, y: top, z: 61.2, w: 2.5, h: 1.7, normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) }))
    c.b.cyl(40.9, top + 0.022, 61.6, 0.008, 0.16, PAL.abysse, 'x')
    c.b.cyl(41.05, top + 0.03, 61.75, 0.035, 0.06, PAL.interieurOmbre)
    const leg = (ax: number, az: number, bx: number, bz: number) => {
      const d = new THREE.Vector3(bx - ax, 0, bz - az)
      const len = d.length()
      const m = new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, top + 0.02, (az + bz) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize()), new THREE.Vector3(len, 0.008, 0.012))
      c.b.add(boxGeo, m, brass)
    }
    leg(39.4, 61.7, 39.75, 61.95)
    leg(39.4, 61.7, 39.7, 61.5)
    c.b.sphere(39.4, top + 0.022, 61.7, 0.015, 0.015, 0.015, PAL.laiton)
    c.b.add(new THREE.TorusGeometry(0.07, 0.012, 6, 18), new THREE.Matrix4().compose(new THREE.Vector3(40.7, top + 0.022, 60.75), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1)), brass)
    c.b.cyl(40.82, top + 0.024, 60.66, 0.012, 0.12, PAL.boisOmbre, 'x')
    c.b.add(new THREE.TorusGeometry(0.16, 0.012, 5, 16, Math.PI / 3), new THREE.Matrix4().compose(new THREE.Vector3(41.0, top + 0.03, 62.0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1)), brass)
    for (const a of [Math.PI * 0.42, Math.PI * 0.58]) leg(41.0, 62.0, 41.0 + Math.cos(a) * 0.16, 62.0 - Math.sin(a) * 0.16)
    c.b.cyl(39.0, top + 0.055, 62.0, 0.04, 0.06, soft(PAL.blanc, 0.6, 0.85))
    c.b.cyl(39.0, top + 0.02, 62.0, 0.07, 0.01, soft(PAL.blanc, 0.6, 0.8))
    c.b.cyl(38.85, top + 0.03, 60.45, 0.07, 0.03, PAL.laiton)
    c.b.add(boxGeo, new THREE.Matrix4().compose(new THREE.Vector3(38.88, top + 0.2, 60.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.25), new THREE.Vector3(0.02, 0.36, 0.02)), brass)
    c.b.add(new THREE.ConeGeometry(0.12, 0.13, 14, 1, true), new THREE.Matrix4().makeTranslation(38.98, top + 0.38, 60.5), new THREE.Color(0x3f6b4f))
    c.e.sphere(38.98, top + 0.33, 60.5, 0.04, 0.03, 0.04, new THREE.Color(1, 0.86, 0.6))
    lamp(c, 38.98, top + 0.3, 60.5, 0, PAL.lampe, 3.2, undefined, { hidden: true })
  })

  rigid(c, 40, 0, 59.35, () => {
    chair(c, 40, 59.35, 1, PAL.tissu3)
    col(c, 'prop', 40, 0.25, 59.4, 0.22, 0.25, 0.22)
  })
  rigid(c, 38.0, 0, 61.2, () => {
    stool(c, 38.0, 61.2, 0.5, 0x9a6a50)
    col(c, 'seat', 38.0, 0.25, 61.2, 0.2, 0.25, 0.2, 'chaise-cartes')
    c.out.seats.push(put(c, { id: 'chaise-cartes', x: 38.0, y: 0.5, z: 61.2, yaw: YAW_E }))
  })
  bookcase(c, 36.45, 60, 2.6, 2.4, 0.35, true, 1, [0.12, 0.62, 1.12, 1.62, 2.1])
  col(c, 'prop', 36.45, 1.2, 60, 0.18, 1.2, 1.3)
  bookcase(c, 43.55, 60, 2.6, 2.4, 0.35, true, -1, [0.12, 0.62, 1.12, 1.62, 2.1])
  col(c, 'prop', 43.55, 1.2, 60, 0.18, 1.2, 1.3)
  c.b.sphere(43.4, 2.62, 60.6, 0.15, 0.15, 0.15, soft(PAL.clair, 0.7, 0.8))
  c.b.add(new THREE.TorusGeometry(0.17, 0.01, 4, 20), new THREE.Matrix4().compose(new THREE.Vector3(43.4, 2.62, 60.6), new THREE.Quaternion().setFromAxisAngle(UPV, 0.4), new THREE.Vector3(1, 1, 1)), brass)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(36.5, 2.62, 61.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(0.18, 0.18, 0.18)), PAL.laiton)
  rigid(c, 37.0, 0, 65.9, () => {
    c.b.with(SURF.planksX, () => c.b.cyl(37.0, 0.36, 65.9, 0.26, 0.72, soft(PAL.bois, 0.7, 0.8)))
    for (const yy of [0.12, 0.6]) c.b.cyl(37.0, yy, 65.9, 0.27, 0.04, PAL.metalSombre)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * 0.22, 0, Math.cos(a) * 0.22))
      c.b.add(UNIT_CYL, new THREE.Matrix4().compose(new THREE.Vector3(37.0 + Math.cos(a) * 0.12, 0.85 + (i % 3) * 0.06, 65.9 + Math.sin(a) * 0.12), tilt, new THREE.Vector3(0.045, 0.75, 0.045)), soft(i % 3 ? PAL.toile : PAL.creme, 0.7, 0.9 - (i % 2) * 0.08))
    }
    col(c, 'prop', 37.0, 0.36, 65.9, 0.26, 0.36, 0.26)
  })
  for (const [z, gc] of [[63.4, 0x6f8f4e], [64.5, 0x8a7a4a]] as const) {
    c.b.rbox(43.88, 1.65, z, 0.03, 0.5, 0.38, PAL.boisOmbre, 0.01)
    c.b.box(43.86, 1.65, z, 0.01, 0.42, 0.3, soft(PAL.toile, 0.7, 0.92))
    c.b.add(sphereLow, new THREE.Matrix4().compose(new THREE.Vector3(43.85, 1.65, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4), new THREE.Vector3(0.004, 0.15, 0.06)), soft(gc, 0.7))
  }
  armchair(c, 41.9, 65.3, 1, 0x9a4e44)
  col(c, 'prop', 41.9, 0.3, 65.4, 0.4, 0.3, 0.35)
  rug(c, 40, 63, 4.5, 6, 0x9a4e44, 0xc9a15a)
  lamp(c, 40, 2.4, 61.2, 1.4, PAL.lampe, 7)
  spot(c, 'grand-pere-table', 40, 0.5, 59.4, YAW_S)
  spot(c, 'grand-pere-fenetre', 40, 0, 66.25, YAW_S)
  spot(c, 'grand-pere-fauteuil', 41.9, 0.5, 65.3, YAW_S)
}

export function buildFurniture(part: string, b: GeoBuilder, fade: GeoBuilder, out: FurnitureOut, rand: () => number, e: GeoBuilder = new GeoBuilder()): void {
  const c: Ctx = { part, b, fade, out, rand, e, delta: null }
  const move = (p: THREE.Vector3) => {
    const q = at(c, p.x, p.y, p.z)
    p.set(q.x, q.y, q.z)
  }
  for (const g of [b, fade, e]) g.move = move
  b.colorPat = patForColor
  fade.colorPat = patForColor
  switch (part) {
    case 'sas': sas(c); break
    case 'sas-chambre': sasChambre(c); break
    case 'echelle-toit': echelleToit(c); break
    case 'coursive-sud': coursive(c); break
    case 'cabine': cabine(c); break
    case 'cabines-voisins': voisins(c); break
    case 'refectoire': refectoire(c); break
    case 'cuisine': cuisine(c); break
    case 'passerelle-1':
    case 'passerelle-2':
    case 'passerelle-3': passerelle(c); break
    case 'marche': marche(c); break
    case 'salle-des-cartes': salleDesCartes(c); break
  }
  b.colorPat = null
  fade.colorPat = null
  for (const g of [b, fade, e]) g.move = null
}
