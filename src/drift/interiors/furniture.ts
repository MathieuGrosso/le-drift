import * as THREE from 'three'
import type { ColliderKind } from '../../core/types'
import { GeoBuilder } from '../builder'
import { PAL } from '../palette'
import { patForColor } from '../surface'
import { REBORD } from './layout'
import type { ColliderSpec, LadderDef, LampDef, PendulumDef, SeatDef, Spot } from './types'

export interface Decal {
  kind: 'board' | 'chart' | 'drawings'
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
  steam: { part: string; x: number; y: number; z: number }[]
}

export function emptyFurniture(): FurnitureOut {
  return { colliders: [], lamps: [], seats: [], ladders: [], pendulums: [], spots: {}, benchSeats: [], decals: [], steam: [] }
}

type Ctx = { part: string; b: GeoBuilder; fade: GeoBuilder; out: FurnitureOut; rand: () => number }

function col(c: Ctx, kind: ColliderKind, x: number, y: number, z: number, hx: number, hy: number, hz: number, ownerId?: string): void {
  c.out.colliders.push({ part: c.part, kind, climbable: false, x, y, z, hx, hy, hz, ...(ownerId ? { ownerId } : {}) })
}

function lamp(c: Ctx, x: number, y: number, z: number, cord: number, color: number = PAL.lampe, radius = 6.5, airlock?: 'sas' | 'echelle-toit'): void {
  c.out.lamps.push({ part: c.part, x, y, z, cord, color, radius, ...(airlock ? { airlock } : {}) })
}

function spot(c: Ctx, id: string, x: number, y: number, z: number, yaw: number): void {
  c.out.spots[id] = { part: c.part, x, y, z, yaw }
}

const YAW_N = 0
const YAW_E = Math.PI / 2
const YAW_S = Math.PI
const YAW_W = -Math.PI / 2

function crate(c: Ctx, x: number, z: number, s: number, stack = 1, solid = true): void {
  for (let i = 0; i < stack; i++) {
    const r = c.rand()
    c.b.box(x + (r - 0.5) * 0.08, s / 2 + i * s, z, s, s, s, r > 0.5 ? PAL.bois : PAL.boisClair, (r - 0.5) * 0.5)
    c.b.box(x, s / 2 + i * s, z, s * 1.02, s * 0.12, s * 1.02, PAL.boisOmbre)
  }
  if (solid) col(c, 'prop', x, (s * stack) / 2, z, s / 2, (s * stack) / 2, s / 2)
}

function barrel(c: Ctx, x: number, z: number, r = 0.32, h = 0.85): void {
  c.b.cyl(x, h / 2, z, r, h, PAL.bois)
  c.b.cyl(x, h * 0.2, z, r * 1.03, 0.06, PAL.metalSombre)
  c.b.cyl(x, h * 0.8, z, r * 1.03, 0.06, PAL.metalSombre)
  col(c, 'prop', x, h / 2, z, r, h / 2, r)
}

function jarRow(c: Ctx, x0: number, x1: number, y: number, z: number, alongZ = false): void {
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
  for (const y of ys) {
    if (alongZ) c.b.box(x, y, z, depth, 0.04, len, PAL.bois)
    else c.b.box(x, y, z, len, 0.04, depth, PAL.bois)
    if (alongZ) jarRow(c, z - len / 2 + 0.1, z + len / 2 - 0.1, y + 0.02, x, true)
    else jarRow(c, x - len / 2 + 0.1, x + len / 2 - 0.1, y + 0.02, z)
  }
}

function table(c: Ctx, x: number, z: number, sx: number, sz: number, h: number, color: number = PAL.bois): void {
  c.b.box(x, h - 0.03, z, sx, 0.06, sz, color)
  const lx = sx / 2 - 0.08
  const lz = sz / 2 - 0.08
  for (const [dx, dz] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]] as const) c.b.box(x + dx, (h - 0.06) / 2, z + dz, 0.07, h - 0.06, 0.07, PAL.boisOmbre)
}

function stool(c: Ctx, x: number, z: number, h = 0.48, color: number = PAL.bois): void {
  c.b.cyl(x, h - 0.03, z, 0.2, 0.06, color)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    c.b.box(x + Math.cos(a) * 0.12, (h - 0.06) / 2, z + Math.sin(a) * 0.12, 0.04, h - 0.06, 0.04, PAL.boisOmbre)
  }
}

function bunk(c: Ctx, x: number, z: number, sx: number, sz: number, blanket: number): void {
  c.b.box(x, 0.2, z, sx, 0.4, sz, PAL.bois)
  c.b.box(x, 0.47, z, sx - 0.08, 0.14, sz - 0.08, PAL.toile)
  const alongZ = sz > sx
  if (alongZ) {
    c.b.box(x, 0.56, z - sz * 0.12, sx - 0.04, 0.06, sz * 0.7, blanket)
    c.b.box(x, 0.6, z + sz / 2 - 0.3, sx * 0.6, 0.12, 0.35, PAL.blanc)
  } else {
    c.b.box(x - sx * 0.12, 0.56, z, sx * 0.7, 0.06, sz - 0.04, blanket)
    c.b.box(x + sx / 2 - 0.3, 0.6, z, 0.35, 0.12, sz * 0.6, PAL.blanc)
  }
}

function rug(c: Ctx, x: number, z: number, sx: number, sz: number, color: number, stripe: number): void {
  c.b.box(x, 0.012, z, sx, 0.02, sz, color)
  c.b.box(x, 0.016, z, sx * 0.86, 0.02, sz * 0.86, stripe)
  c.b.box(x, 0.02, z, sx * 0.7, 0.02, sz * 0.7, color)
}

function pipe(c: Ctx, x0: number, x1: number, y: number, z: number, r: number, color: number, alongZ = false): void {
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

function laundry(c: Ctx, x0: number, x1: number, y: number, z: number, alongZ = false): void {
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

function bunting(c: Ctx, x0: number, x1: number, y: number, z: number, sag: number, alongZ = false): void {
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
}
const coneGeo = new THREE.ConeGeometry(1, 1, 10)
const torusGeo = new THREE.TorusGeometry(1, 0.3, 6, 12)

function scrubber(c: Ctx, x: number, y: number, z: number): void {
  c.b.cyl(x, y, z, 0.02, 1.0, PAL.bois)
  c.b.cyl(x, y + 0.55, z, 0.11, 0.08, PAL.laiton)
  c.b.cyl(x, y + 0.62, z, 0.1, 0.06, PAL.tissu2)
}

function ladder(c: Ctx, id: string, x: number, z: number, y0: number, y1: number, nx: number, nz: number, rooms: LadderDef['rooms']): void {
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
}

function sas(c: Ctx): void {
  c.b.box(2.84, 1.65, 65.3, 0.06, 0.9, 1.45, PAL.bois)
  c.out.decals.push({ kind: 'board', part: c.part, x: 2.8, y: 1.65, z: 65.3, w: 1.3, h: 0.75, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) })
  stool(c, 2.1, 66.6, 0.5, PAL.tissu1)
  col(c, 'seat', 2.1, 0.25, 66.6, 0.2, 0.25, 0.2, 'tabouret-rouille')
  c.out.seats.push({ id: 'tabouret-rouille', part: c.part, x: 2.1, y: 0.5, z: 66.6, yaw: YAW_W })
  c.b.box(-2.55, 0.42, 67.75, 0.45, 0.06, 2.9, PAL.bois)
  for (const z of [66.4, 67.75, 69.1]) c.b.box(-2.55, 0.2, z, 0.4, 0.4, 0.06, PAL.boisOmbre)
  col(c, 'seat', -2.55, 0.23, 67.75, 0.22, 0.23, 1.45, 'banc-sas')
  c.out.seats.push({ id: 'banc-sas', part: c.part, x: -2.55, y: 0.45, z: 67.4, yaw: YAW_E })
  for (const z of [66.6, 67.4, 68.2, 69.0]) {
    c.b.cyl(-2.76, 1.75, z, 0.03, 0.08, PAL.laiton, 'x')
    scrubber(c, -2.68, 1.35, z)
  }
  c.b.box(2.0, 1.85, 63.55, 1.4, 0.04, 0.3, PAL.bois)
  for (const x of [1.5, 2.0, 2.5]) c.b.sphere(x, 2.0, 63.55, 0.14, 0.15, 0.14, PAL.laiton)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.9, 0.12, 69.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.3, 0.3, 0.3)), PAL.corde)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.9, 0.2, 69.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.24, 0.24, 0.3)), PAL.corde)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(1.0, 1.35, 69.76), new THREE.Quaternion(), new THREE.Vector3(0.16, 0.16, 0.16)), PAL.tissu1)
  pipe(c, 63.4, 69.8, 2.55, 1.6, 0.06, PAL.metal, true)
  pipe(c, 63.4, 69.8, 2.62, 1.85, 0.04, PAL.laiton, true)
  c.b.box(0, 0.01, 66.6, 1.6, 0.02, 3.6, PAL.metalSombre)
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
  crate(c, 4.2, 61.3, 0.5, 2)
  crate(c, 4.8, 61.3, 0.4, 1)
  barrel(c, 8.6, 62.75, 0.25, 0.7)
  barrel(c, -13.3, 61.3, 0.25, 0.7)
  for (const x of [-11, -5, 1, 7]) lamp(c, x, 2.45, 62.0, 0.35)
  spot(c, 'coursive-a', -11, 0, 62, YAW_E)
  spot(c, 'coursive-b', 8, 0, 62, YAW_W)
}

function cabine(c: Ctx): void {
  bunk(c, -5.65, 65.65, 0.9, 2.55, PAL.tissu1)
  c.b.box(-5.65, 0.75, 64.4, 0.9, 0.5, 0.06, PAL.bois)
  col(c, 'seat', -5.65, 0.28, 65.65, 0.45, 0.28, 1.27, 'couchette-cabine')
  c.out.seats.push({ id: 'couchette-cabine', part: c.part, x: -5.65, y: 0.56, z: 65.65, yaw: YAW_S, lying: true })
  c.out.decals.push({ kind: 'drawings', part: c.part, x: -5.22, y: 1.45, z: 65.6, w: 1.8, h: 0.9, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) })
  table(c, -8.45, 64.3, 0.6, 1.0, 0.75)
  col(c, 'prop', -8.45, 0.38, 64.3, 0.3, 0.38, 0.5)
  stool(c, -7.85, 64.4)
  c.b.box(-8.45, 0.8, 64.0, 0.25, 0.04, 0.18, PAL.blanc)
  c.b.cyl(-8.35, 0.84, 64.6, 0.04, 0.09, PAL.tissu3)
  c.b.box(-8.75, 1.6, 65.6, 0.25, 0.04, 1.4, PAL.bois)
  trouvailles(c, -8.72, 1.62, 65.6, 5, 1.2, true)
  scrubber(c, -8.7, 0.6, 66.8)
  c.b.sphere(-8.5, 0.82, 64.7, 0.07, 0.05, 0.07, PAL.laiton)
  rug(c, -7.2, 65.4, 1.6, 2.2, PAL.tissu3, PAL.tissu2)
  c.fade.box(-5.24, 1.4, 67.0, 0.04, 0.7, 0.18, PAL.echarpe)
  for (const dx of [-0.13, 0.13]) {
    c.b.box(-7.95 + dx, 0.14, 63.65, 0.11, 0.28, 0.16, 0x4a3a40)
    c.b.box(-7.95 + dx, 0.04, 63.58, 0.11, 0.08, 0.3, 0x4a3a40)
  }
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(-8.4, 0.06, 66.7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.16, 0.16, 0.2)), PAL.corde)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(-8.4, 0.13, 66.7), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(0.12, 0.12, 0.2)), PAL.corde)
  c.b.box(-8.79, 1.45, 64.15, 0.02, 0.4, 0.3, PAL.creme)
  for (let i = 0; i < 9; i++) c.b.box(-8.775, 1.52 - Math.floor(i / 3) * 0.08, 64.07 + (i % 3) * 0.08, 0.01, 0.012, 0.05, PAL.tissu1)
  c.fade.cyl(-7.4, 2.75, 66.0, 0.005, 0.7, PAL.corde)
  c.fade.cyl(-7.4, 2.4, 66.0, 0.006, 0.5, PAL.boisOmbre, 'x')
  for (let i = 0; i < 3; i++) {
    const fx = -7.6 + i * 0.2
    c.fade.cyl(fx, 2.3, 66.0, 0.004, 0.18, PAL.corde)
    c.fade.sphere(fx, 2.17, 66.0, 0.07, 0.04, 0.025, [PAL.tissu1, PAL.clair, PAL.tissu2][i]!)
  }
  c.b.cyl(-8.7, 1.71, 65.1, 0.05, 0.14, PAL.clair)
  for (let i = 0; i < 5; i++) c.b.sphere(-8.7 + (i % 2) * 0.02, 1.66 + i * 0.02, 65.1, 0.02, 0.015, 0.02, [PAL.clair, PAL.vertDoux, PAL.blanc][i % 3]!)
  lamp(c, -7, 2.55, 65.4, 0.3, PAL.lampe, 4.5)
  lamp(c, -5.5, 1.95, 66.9, 0.0, PAL.lampeChaude, 3)
  spot(c, 'cabine-centre', -7, 0, 65.4, YAW_S)
}

function voisins(c: Ctx): void {
  c.fade.box(-6.0, 1.15, 57.5, 0.03, 2.1, 2.2, PAL.tissu3)
  col(c, 'prop', -6.0, 1.0, 57.5, 0.05, 1.0, 1.1)
  bunk(c, -7.7, 55.65, 2.2, 0.9, PAL.tissu2)
  bunk(c, -4.3, 55.65, 2.2, 0.9, PAL.tissu1)
  col(c, 'prop', -7.7, 0.28, 55.65, 1.1, 0.28, 0.45)
  col(c, 'prop', -4.3, 0.28, 55.65, 1.1, 0.28, 0.45)
  table(c, -4.4, 57.9, 0.9, 0.7, 0.72)
  col(c, 'prop', -4.4, 0.36, 57.9, 0.45, 0.36, 0.35)
  stool(c, -3.75, 57.9)
  for (const x of [-4.6, -4.2]) c.b.cyl(x, 0.77, 57.8, 0.05, 0.1, PAL.blanc)
  laundry(c, -8.6, -6.4, 1.9, 59.6)
  barrel(c, -8.5, 58.2, 0.25, 0.6)
  rug(c, -6, 59.7, 2.4, 1.2, PAL.tissu2, PAL.tissu1)
  lamp(c, -7.5, 2.35, 57.6, 0.3)
  lamp(c, -4.5, 2.35, 57.6, 0.3)
  spot(c, 'voisin-lit-a', -7.6, 0.56, 55.65, YAW_W)
  spot(c, 'voisin-lit-b', -4.4, 0.56, 55.65, YAW_W)
  spot(c, 'voisin-table', -3.75, 0, 57.9, YAW_W)
  spot(c, 'voisin-debout', -7.5, 0, 59.2, YAW_S)
}

export const BENCH_ROWS = [59.2, 61.8, 64.4, 67.0]
export const BENCH_HALVES: readonly [number, number][] = [[11.8, 17.2], [18.8, 24.4]]

function refectoire(c: Ctx): void {
  for (const z of BENCH_ROWS) {
    for (const [x0, x1] of BENCH_HALVES) {
      const xm = (x0 + x1) / 2
      const len = x1 - x0
      c.b.box(xm, 0.43, z, len, 0.07, 0.38, PAL.bois)
      for (const x of [x0 + 0.2, xm, x1 - 0.2]) c.b.box(x, 0.2, z, 0.08, 0.4, 0.3, PAL.boisOmbre)
      table(c, xm, z + 0.65, len, 0.5, 0.74)
      col(c, 'prop', xm, 0.37, z + 0.35, len / 2, 0.37, 0.55)
      for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.72) {
        c.out.benchSeats.push({ part: c.part, x, y: 0.47, z, yaw: YAW_S })
        c.b.cyl(x, 0.765, z + 0.6, 0.085, 0.05, c.rand() > 0.5 ? PAL.blanc : PAL.bleuDoux)
        c.b.cyl(x, 0.79, z + 0.6, 0.06, 0.02, PAL.poisson)
        if (c.rand() > 0.5) c.b.cyl(x + 0.18, 0.79, z + 0.72, 0.04, 0.1, PAL.tissu2)
      }
    }
  }
  const ilo = { x: 19.2, y: 0.47, z: 67.0 }
  c.b.box(ilo.x, 0.5, ilo.z, 0.42, 0.06, 0.36, PAL.tissu1)
  col(c, 'seat', ilo.x, 0.5, ilo.z, 0.21, 0.08, 0.18, 'siege-ilo')
  c.out.seats.push({ id: 'siege-ilo', part: c.part, ...ilo, yaw: YAW_S })
  c.out.benchSeats = c.out.benchSeats.filter((s) => Math.hypot(s.x - ilo.x, s.z - ilo.z) > 0.3)

  const R = REBORD
  c.b.box((R.x0 + R.x1) / 2, R.top / 2, (R.stepZ + 71.8) / 2, R.x1 - R.x0, R.top, 71.8 - R.stepZ, PAL.boisClair)
  c.b.box((R.x0 + R.x1) / 2, 0.15, (R.z0 + R.stepZ) / 2, R.x1 - R.x0 - 1.6, 0.3, R.stepZ - R.z0, PAL.bois)
  col(c, 'interior', (R.x0 + R.x1) / 2, R.top / 2, (R.stepZ + 71.8) / 2, (R.x1 - R.x0) / 2, R.top / 2, (71.8 - R.stepZ) / 2)
  col(c, 'stair', (R.x0 + R.x1) / 2, 0.15, (R.z0 + R.stepZ) / 2, (R.x1 - R.x0 - 1.6) / 2, 0.15, (R.stepZ - R.z0) / 2)
  for (const [x, color] of [[14.6, PAL.tissu1], [16.4, PAL.tissu2], [19.8, PAL.tissu3], [21.6, PAL.tissu1]] as const) {
    c.b.box(x, R.top + 0.05, 70.9, 1.0, 0.1, 0.7, color)
  }
  c.out.seats.push({ id: 'banc-rebord', part: c.part, x: 18, y: R.top + 0.05, z: 70.9, yaw: YAW_S })
  for (const x of [R.x0 + 0.4, R.x1 - 0.4]) {
    c.b.box(x, 1.6, 70.6, 0.7, 2.0, 0.08, PAL.bois)
    for (const y of [1.1, 1.6, 2.1]) {
      c.b.box(x, R.top + y - 0.6, 70.6 - 0.2, 0.7, 0.04, 0.4, PAL.bois)
      trouvailles(c, x, R.top + y - 0.58, 70.45, 3, 0.45, false)
    }
    col(c, 'prop', x, 1.6, 70.45, 0.35, 1.0, 0.25)
  }
  c.b.box(15.5, 0.5, 57.35, 2.6, 1.0, 0.7, PAL.bois)
  c.b.box(15.5, 1.02, 57.35, 2.7, 0.05, 0.8, PAL.boisClair)
  col(c, 'prop', 15.5, 0.5, 57.35, 1.3, 0.5, 0.35, 'comptoir')
  for (let i = 0; i < 4; i++) c.b.sphere(14.6 + i * 0.5, 1.12, 57.3, 0.16, 0.09, 0.11, PAL.pain)
  c.b.cyl(16.6, 1.22, 57.4, 0.25, 0.35, PAL.metal)
  bunting(c, 10.4, 25.6, 6.6, 60.5, 0.6)
  bunting(c, 10.4, 25.6, 6.4, 66.5, 0.5)
  bunting(c, 59.5, 68.5, 6.5, 18, 0.4, true)
  for (const [x, z] of [[13, 60.5], [18, 60.5], [23, 60.5], [13, 66], [18, 66], [23, 66]] as const) lamp(c, x, 5.4, z, 1.3, PAL.lampe, 9.5)
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
  c.b.box(16.6, 0.45, 49.0, 2.0, 0.9, 1.2, PAL.metalSombre)
  c.b.box(16.6, 0.93, 49.0, 2.1, 0.06, 1.3, PAL.metal)
  c.b.box(16.6, 0.35, 49.62, 0.6, 0.35, 0.02, PAL.lampeChaude)
  c.b.cyl(17.3, 2.6, 48.7, 0.12, 3.4, PAL.metalSombre)
  col(c, 'prop', 16.6, 0.45, 49.0, 1.0, 0.45, 0.6)
  c.b.cyl(16.3, 1.18, 49.0, 0.36, 0.45, PAL.metal)
  c.b.cyl(16.3, 1.42, 49.0, 0.38, 0.04, PAL.laiton)
  col(c, 'prop', 16.3, 1.18, 49.0, 0.36, 0.25, 0.36, 'marmite-drift')
  c.out.steam.push({ part: c.part, x: 16.3, y: 1.45, z: 49.0 })
  table(c, 13.5, 52.0, 3.0, 1.2, 0.85)
  col(c, 'prop', 13.5, 0.43, 52.0, 1.5, 0.43, 0.6)
  for (let i = 0; i < 5; i++) c.b.sphere(12.4 + i * 0.45, 0.94, 51.8 + (i % 2) * 0.2, 0.16 + c.rand() * 0.05, 0.09, 0.12, PAL.pain)
  for (let i = 0; i < 3; i++) c.b.sphere(13.9 + i * 0.4, 0.9, 52.35, 0.18, 0.05, 0.07, PAL.poisson)
  c.b.box(14.9, 0.89, 51.7, 0.4, 0.03, 0.3, PAL.boisClair)
  shelf(c, 12.6, 48.35, 4.0, [1.2, 1.7, 2.2], false)
  shelf(c, 10.35, 53.5, 3.0, [1.3, 1.8], true)
  c.fade.cyl(13.5, 2.45, 52.0, 0.03, 3.4, PAL.metal, 'x')
  for (let i = 0; i < 5; i++) c.out.pendulums.push({ part: c.part, x: 12.1 + i * 0.7, y: 2.45, z: 52.0, cord: 0.35 + (i % 2) * 0.12, scale: 0.8 + (i % 3) * 0.2 })
  laundry(c, 50.2, 52.8, 2.4, 10.8, true)
  for (let i = 0; i < 6; i++) {
    c.fade.cyl(10.8, 2.3, 50.4 + i * 0.4, 0.006, 0.2, PAL.corde)
    c.fade.sphere(10.8, 2.1, 50.4 + i * 0.4, 0.03, 0.11, 0.025, 0x8fa4ae)
  }
  for (let i = 0; i < 3; i++) c.fade.cyl(17.6, 2.05, 51.2 + i * 0.35, 0.05, 0.4, i === 1 ? PAL.revetement : PAL.laminaire)
  c.b.sphere(17.5, 0.12, 53.2, 0.2, 0.12, 0.14, 0x4e4458)
  c.b.sphere(17.37, 0.24, 53.2, 0.08, 0.08, 0.08, 0x4e4458)
  barrel(c, 17.4, 55.3, 0.3, 0.8)
  crate(c, 17.4, 54.4, 0.45, 2)
  c.b.box(11.2, 0.2, 55.4, 0.6, 0.4, 0.4, PAL.toile)
  lamp(c, 12.5, 2.95, 52, 0.5)
  lamp(c, 16, 2.95, 52.5, 0.5)
  lamp(c, 16.6, 0.6, 49.9, 0, PAL.lampeChaude, 2.5)
  spot(c, 'cuistot-fourneau', 16.4, 0, 50.0, YAW_N)
  spot(c, 'cuistot-table', 13.5, 0, 53.0, YAW_N)
}

function passerelle(c: Ctx, x0: number, x1: number, z: number): void {
  for (const s of [-0.7, 0.7]) {
    c.b.cyl((x0 + x1) / 2, 0.95, z + s, 0.03, x1 - x0 - 0.4, PAL.laiton, 'x')
    for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.5) c.b.box(x, 0.48, z + s, 0.04, 0.95, 0.04, PAL.metalSombre)
  }
  c.b.box((x0 + x1) / 2, 0.01, z, x1 - x0 - 0.4, 0.02, 0.5, PAL.metalSombre)
  lamp(c, (x0 + x1) / 2, 2.4, z, 0.2, PAL.lampe, 4)
}

function marche(c: Ctx): void {
  const stall = (id: string, x: number, z: number, alongZ: boolean, color: number, goods: (cx: number, cz: number) => void, keeperYaw: number, keeperDx: number) => {
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
  c.out.seats.push({ id: 'banc-marche', part: c.part, x: -33, y: 0.45, z: 61.0, yaw: YAW_S })
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
  c.b.box(x, y + 0.12, z, 0.4, 0.24, 0.35, c.rand() > 0.5 ? PAL.bois : PAL.boisClair)
  c.b.sphere(x, y + 0.27, z, 0.08, 0.05, 0.08, [PAL.tissu1, PAL.tissu2, PAL.clair][Math.floor(c.rand() * 3)]!)
}

function salleDesCartes(c: Ctx): void {
  table(c, 40, 61.2, 2.8, 2.0, 0.95, PAL.boisOmbre)
  c.b.box(40, 0.9, 61.2, 2.6, 0.04, 1.8, PAL.bois)
  col(c, 'prop', 40, 0.48, 61.2, 1.4, 0.48, 1.0, 'table-carte')
  c.out.decals.push({ kind: 'chart', part: c.part, x: 40, y: 0.985, z: 61.2, w: 2.5, h: 1.7, normal: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) })
  c.b.cyl(40.9, 1.0, 61.6, 0.012, 0.16, PAL.abysse, 'x')
  c.b.cyl(38.9, 1.03, 60.5, 0.06, 0.12, PAL.laiton)
  stool(c, 40, 59.4, 0.5, PAL.tissu3)
  c.b.box(40, 0.85, 59.15, 0.5, 0.6, 0.06, PAL.bois)
  col(c, 'prop', 40, 0.25, 59.4, 0.22, 0.25, 0.22)
  stool(c, 38.0, 61.2, 0.5, PAL.tissu1)
  col(c, 'seat', 38.0, 0.25, 61.2, 0.2, 0.25, 0.2, 'chaise-cartes')
  c.out.seats.push({ id: 'chaise-cartes', part: c.part, x: 38.0, y: 0.5, z: 61.2, yaw: YAW_E })
  for (const x of [36.45, 43.55]) {
    c.b.box(x, 1.2, 60, 0.35, 2.4, 2.6, PAL.bois)
    for (const y of [0.5, 1.1, 1.7]) {
      for (let i = 0; i < 6; i++) c.b.cyl(x, y + 0.12, 58.9 + i * 0.4, 0.08, 0.3, PAL.toile, 'x')
    }
    col(c, 'prop', x, 1.2, 60, 0.18, 1.2, 1.3)
  }
  c.b.sphere(43.4, 2.55, 60.6, 0.15, 0.15, 0.15, PAL.laiton)
  c.b.add(torusGeo, new THREE.Matrix4().compose(new THREE.Vector3(36.5, 2.55, 61.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(0.18, 0.18, 0.18)), PAL.laiton)
  c.b.box(41.9, 0.25, 65.4, 0.8, 0.5, 0.7, PAL.tissu1)
  c.b.box(41.9, 0.75, 65.75, 0.8, 0.6, 0.15, PAL.tissu1)
  col(c, 'prop', 41.9, 0.3, 65.4, 0.4, 0.3, 0.35)
  rug(c, 40, 63, 4.5, 6, PAL.tissu1, PAL.tissu2)
  lamp(c, 40, 2.4, 61.2, 1.4, PAL.lampe, 8)
  lamp(c, 38.9, 1.25, 60.5, 0, PAL.lampeChaude, 2.5)
  spot(c, 'grand-pere-table', 40, 0.5, 59.4, YAW_S)
  spot(c, 'grand-pere-fenetre', 40, 0, 66.25, YAW_S)
  spot(c, 'grand-pere-fauteuil', 41.9, 0.5, 65.3, YAW_S)
}

export function buildFurniture(part: string, b: GeoBuilder, fade: GeoBuilder, out: FurnitureOut, rand: () => number): void {
  const c: Ctx = { part, b, fade, out, rand }
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
    case 'passerelle-1': passerelle(c, -26, -14, 62); break
    case 'passerelle-2': passerelle(c, 26, 36, 62); break
    case 'passerelle-3': passerelle(c, -26, -9, 57.5); break
    case 'marche': marche(c); break
    case 'salle-des-cartes': salleDesCartes(c); break
  }
  b.colorPat = null
  fade.colorPat = null
}
