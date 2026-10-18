import * as THREE from 'three'
import type { ColliderTag, QualityLevel, Vec3 } from '../core/types'
import { PLANT_COLORS as P } from './palette'
import { PlantGeo, RIGID, SWAY } from './plantgeo'
import { cord, dryingLine, floatingAlgae, hangingBasket, kelpStalk, leafyCrown, nurseryRack, railPlanter, sway, trailingVine, uprightFrond } from './plants'
import type { ShapeSpec } from './ship'

// Mirrors drift's `serre-cathedrale` hall (city/world.ts SERRES + serres()); Drift-local.
export const SERRE_HALL = { x0: 72, x1: 108, z0: -6, z1: 72, gallery: 7, railW: 78.75, railE: 101.25 } as const
const BED_X = [82, 90, 98] as const
const BED_Z = [[1, 18], [22, 40], [48, 68]] as const
const BED_HALF = 1.1
const WATER_Y = 0.6
const GROW_OF_COLUMN = [0, 2, 1] as const
const CROPS: readonly (readonly number[])[] = [
  [P.algueRouge, P.algueRougeClair, P.algueRouge],
  [P.algueDoree, P.varechClair, P.laminaire],
  [P.laitue, P.herbe, P.feuilleClaire],
]
const RAIL_GAPS: Record<'w' | 'e', readonly (readonly [number, number])[]> = {
  w: [[42.5, 45.5], [17.8, 20.2], [8.5, 11.5]],
  e: [[42.5, 45.5], [59.8, 62.2], [8.5, 11.5]],
}
const ARCH_X = [86, 94] as const
const ARCH_Z = [4, 12, 20, 28, 36, 52, 60, 68] as const
const ARCH = { y: 4.2, rx: 2.8, ry: 2.2 } as const

export const SERRE_COLUMNS = [
  { id: 'serre-colonne-ouest', x: 82.2, z: 20, h: 11, r: 0.9 },
  { id: 'serre-colonne-mere', x: 90, z: 20, h: 16, r: 1.05 },
  { id: 'serre-colonne-est', x: 97.8, z: 20, h: 11, r: 0.9 },
  { id: 'serre-cuve-ouest', x: 82, z: 44, h: 6.1, r: 0.8 },
  { id: 'serre-cuve-est', x: 98, z: 44, h: 6.1, r: 0.8 },
] as const

export const SERRE_TRELLIS = [
  { id: 'serre-treille-ouest', x: 79.7, z: 36, top: 8.3 },
  { id: 'serre-treille-est', x: 100.3, z: 26, top: 8.3 },
] as const

export interface SerreBuild {
  plants: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  tanks: THREE.BufferGeometry
  bubbles: THREE.BufferGeometry
  colliders: { spec: ShapeSpec; tag: ColliderTag }[]
  stalks: { base: Vec3; height: number }[]
}

const inGap = (z: number, gaps: readonly (readonly [number, number])[], pad: number) => gaps.some(([a, b]) => z > a - pad && z < b + pad)

export function buildSerres(rng: () => number, level: QualityLevel): SerreBuild {
  const g = new PlantGeo()
  const glow = new PlantGeo()
  const colliders: SerreBuild['colliders'] = []
  const stalks: SerreBuild['stalks'] = []
  const density = level === 'high' ? 1 : level === 'medium' ? 0.65 : 0.4
  const pickOf = <T>(l: readonly T[]): T => l[Math.floor(rng() * l.length)]!

  BED_X.forEach((cx, col) => {
    const grow = GROW_OF_COLUMN[col]!
    const crop = CROPS[col]!
    for (const [z0, z1] of BED_Z) {
      for (let z = z0 + 0.6; z < z1 - 0.4; z += (0.75 + rng() * 0.4) / Math.sqrt(density)) {
        const base = new THREE.Vector3(cx + (rng() - 0.5) * 1.3, WATER_Y - 0.45, z)
        const tall = 3.8 + rng() * 4
        const blades = 2 + Math.floor(rng() * 3)
        for (let b = 0; b < blades; b++) laminaria(g, rng, base, tall * (0.62 + rng() * 0.38), grow)
      }
      const step = 0.62 / Math.sqrt(density)
      let side = 1
      for (let z = z0 + 0.5; z < z1 - 0.4; z += step * (2.2 + rng() * 0.8)) {
        side = -side
        const h = (col === 1 ? 1.6 : 1.1) + rng() * 1.0 + Math.sin(z * 0.7) * 0.25
        const tint = col === 0 ? pickOf([P.varech, P.algueRouge, P.laminaire]) : col === 1 ? pickOf([P.laminaire, P.varechClair, P.algueDoree]) : pickOf([P.varech, P.feuille, P.laitue])
        kelpStalk(g, rng, new THREE.Vector3(cx + side * (0.15 + rng() * 0.45), WATER_Y - 0.45, z), h, { grow, bladeLen: 0.95, tint })
      }
      for (let z = z0 + 0.5; z < z1 - 0.4; z += (0.75 + rng() * 0.4) / Math.sqrt(density)) {
        for (const sx of [-1, 1]) {
          if (rng() < 0.2) continue
          const x = cx + sx * (BED_HALF - 0.3 - rng() * 0.15)
          floatingAlgae(g, rng, new THREE.Vector3(x, WATER_Y, z + (rng() - 0.5) * 0.3), 0.35 + rng() * 0.2, crop, grow)
        }
        if (rng() < 0.3 * density) uprightFrond(g, rng, new THREE.Vector3(cx + (rng() - 0.5) * 1.4, WATER_Y - 0.1, z), 0.5 + rng() * 0.5, pickOf(crop), grow)
      }
    }
  })

  for (const c of SERRE_COLUMNS) {
    const brass = new THREE.Color(P.laiton)
    const ring = (y: number, r: number, h: number) => {
      g.add(new THREE.CylinderGeometry(r, r, h, 28, 1, true), new THREE.Matrix4().makeTranslation(c.x, y, c.z), brass, RIGID)
      const top = new THREE.RingGeometry(c.r - 0.05, r, 28)
      top.rotateX(-Math.PI / 2)
      g.add(top, new THREE.Matrix4().makeTranslation(c.x, y + h / 2, c.z), brass, RIGID)
    }
    ring(0.35, c.r + 0.14, 0.7)
    ring(c.h - 0.12, c.r + 0.1, 0.24)
    for (let y = 3; y < c.h - 1; y += 3) ring(y, c.r + 0.04, 0.1)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const px = c.x + Math.cos(a) * (c.r + 0.03)
      const pz = c.z + Math.sin(a) * (c.r + 0.03)
      g.add(new THREE.BoxGeometry(0.07, c.h - 0.9, 0.07), new THREE.Matrix4().makeTranslation(px, 0.7 + (c.h - 0.9) / 2, pz), brass, RIGID)
    }
    const cap = new THREE.SphereGeometry(c.r + 0.1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    g.add(cap, new THREE.Matrix4().makeTranslation(c.x, c.h, c.z), brass.clone().multiplyScalar(0.9), RIGID)
    const sand = new THREE.CircleGeometry(c.r - 0.02, 20)
    sand.rotateX(-Math.PI / 2)
    g.add(sand, new THREE.Matrix4().makeTranslation(c.x, 0.72, c.z), new THREE.Color(0xe8d6a8), RIGID)
    for (let k = 0; k < 5; k++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * (c.r - 0.25)
      const rock = new THREE.IcosahedronGeometry(0.08 + rng() * 0.1, 0)
      g.add(rock, new THREE.Matrix4().makeTranslation(c.x + Math.cos(a) * r, 0.74, c.z + Math.sin(a) * r), new THREE.Color(P.pierre), RIGID)
    }
    const n = Math.max(3, Math.round((c.h > 8 ? 7 : 5) * Math.max(0.6, density)))
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.5
      const r = Math.sqrt(rng()) * (c.r - 0.35)
      const top = c.h - 0.6
      kelpStalk(g, rng, new THREE.Vector3(c.x + Math.cos(a) * r, 0.72, c.z + Math.sin(a) * r), top * (0.75 + rng() * 0.2), { grow: 2, bladeLen: c.h > 8 ? 1.1 : 0.8, flex: 0.7, tint: pickOf([P.laminaire, P.varechClair, P.varech, P.algueDoree]) })
    }
    const critters = Math.round(c.h * 1.4)
    for (let k = 0; k < critters; k++) {
      const a = rng() * Math.PI * 2
      const r = rng() * (c.r - 0.25)
      const base = new THREE.Vector3(c.x + Math.cos(a) * r, 0.72, c.z + Math.sin(a) * r)
      const y = 1.0 + rng() * (c.h - 1.8)
      glow.add(new THREE.IcosahedronGeometry(0.03 + rng() * 0.035, 1), new THREE.Matrix4().makeTranslation(base.x, y, base.z), new THREE.Color(rng() < 0.7 ? P.bio1 : 0xb6a8ff), sway(base, SWAY.ribbon, 0.7, rng() * 6.28, 2))
    }
    colliders.push({ spec: { shape: 'cyl', x: c.x, y: c.h / 2, z: c.z, r: c.r + 0.14, hh: c.h / 2 }, tag: { kind: 'glass', climbable: false, ownerId: c.id } })
  }

  for (const tr of SERRE_TRELLIS) {
    const R = 0.55
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      cord(g, new THREE.Vector3(tr.x + Math.cos(a) * R, 0, tr.z + Math.sin(a) * R), new THREE.Vector3(tr.x + Math.cos(a) * R * 0.8, tr.top, tr.z + Math.sin(a) * R * 0.8), 0.025, P.corde)
    }
    for (let y = 0.6; y < tr.top; y += 0.9) {
      const ringG = new THREE.TorusGeometry(R - 0.02, 0.018, 3, 12)
      ringG.rotateX(Math.PI / 2)
      g.add(ringG, new THREE.Matrix4().makeTranslation(tr.x, y, tr.z), new THREE.Color(P.corde), RIGID)
    }
    const steps = 18
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI * 2
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= steps * 4; i++) {
        const u = i / (steps * 4)
        const a = a0 + u * Math.PI * 5
        pts.push(new THREE.Vector3(tr.x + Math.cos(a) * (R + 0.04), u * tr.top, tr.z + Math.sin(a) * (R + 0.04)))
      }
      const c = new THREE.Color(P.stipe)
      g.ribbon(pts, pts.map(() => 0.09), pts.map(() => new THREE.Vector3(0, 1, 0)), pts.map((_, i) => c.clone().multiplyScalar(0.8 + 0.4 * (i / pts.length))), RIGID)
      for (let i = 4; i < pts.length; i += 3) {
        const p = pts[i]!
        kelpBlade(g, rng, p, new THREE.Vector3(p.x - tr.x, 0, p.z - tr.z).normalize(), 0.6 + rng() * 0.5)
      }
    }
    leafyCrown(g, rng, new THREE.Vector3(tr.x, tr.top, tr.z), 9, 1.6, { kind: SWAY.hang, spread: 0.9, droop: 1.3, greens: [P.varechClair, P.laminaire, P.varech], width: 0.14 })
    colliders.push({ spec: { shape: 'capsule', x: tr.x, y: tr.top / 2, z: tr.z, r: R + 0.05, hh: tr.top / 2 - R }, tag: { kind: 'kelp', climbable: true, ownerId: tr.id } })
    stalks.push({ base: { x: tr.x, y: 0, z: tr.z }, height: tr.top })
  }

  const railTop = SERRE_HALL.gallery + 1.0
  for (const [side, x, out] of [['w', SERRE_HALL.railW + 0.2, 1], ['e', SERRE_HALL.railE - 0.2, -1]] as const) {
    const gaps = RAIL_GAPS[side]
    for (let z = SERRE_HALL.z0 + 3; z < SERRE_HALL.z1 - 2; z += 4.2 / Math.sqrt(density)) {
      const zz = z + (rng() - 0.5) * 1.2
      if (inGap(zz, gaps, 1.6)) continue
      if (SERRE_TRELLIS.some((t) => Math.abs(t.z - zz) < 2 && Math.abs(t.x - x) < 3)) continue
      railPlanter(g, rng, x, railTop, zz, true, 1.6 + rng() * 1.2, out, 0, 4.4)
    }
  }

  for (const ax of ARCH_X) {
    for (const [i, az] of ARCH_Z.entries()) {
      const pivot = new THREE.Vector3(ax, ARCH.y + ARCH.ry, az)
      const n = Math.round(5 * Math.max(0.6, density))
      for (let k = 0; k < n; k++) {
        const t = 0.12 + rng() * 0.76
        const p = new THREE.Vector3(ax + Math.cos(t * Math.PI) * ARCH.rx, ARCH.y + Math.sin(t * Math.PI) * ARCH.ry - 0.06, az + (rng() - 0.5) * 0.15)
        const len = Math.min(0.5 + rng() * 1.8, p.y - 3.1)
        if (len > 0.25) trailingVine(g, rng, p, len, pivot, { flower: 0.12 })
      }
      if ((i + (ax === 86 ? 0 : 1)) % 2 === 0) hangingBasket(g, rng, new THREE.Vector3(ax, ARCH.y + ARCH.ry - 0.08, az), 0.55, 0.18, 5, 0.95)
    }
  }

  const tints = [P.algueRouge, P.algueDoree, P.algueRougeClair, P.laitue]
  for (const [x, a, b] of [[73.6, 23, 29.5], [74.7, 23.5, 29], [73.6, 40.5, 48.5], [74.7, 41, 48]] as const) {
    dryingLine(g, rng, new THREE.Vector3(x, 2.75, a), new THREE.Vector3(x, 2.75, b), 0.18, tints)
  }

  for (const [x, z0, z1, out] of [[72.3, 1, 14, 1], [72.3, 50, 58, 1], [107.7, 24, 38, -1]] as const) {
    nurseryRack(g, rng, x, z0, z1, out, [0.55, 1.15, 1.75])
    colliders.push({ spec: { shape: 'box', x: x + out * 0.25, y: 0.9, z: (z0 + z1) / 2, hx: 0.25, hy: 0.9, hz: (z1 - z0) / 2 }, tag: { kind: 'shelf', climbable: true, ownerId: 'serre-pepiniere' } })
  }

  const tankParts: THREE.BufferGeometry[] = []
  for (const c of SERRE_COLUMNS) {
    const t = new THREE.CylinderGeometry(c.r, c.r, c.h - 0.7, 32, 1, true)
    t.translate(c.x, 0.7 + (c.h - 0.7) / 2, c.z)
    tankParts.push(t)
  }
  const tanks = mergeSimple(tankParts)

  const bp: number[] = []
  const bs: number[] = []
  for (const c of SERRE_COLUMNS) {
    const nb = Math.round(c.h * 7 * density)
    for (let k = 0; k < nb; k++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * (c.r - 0.25)
      bp.push(c.x + Math.cos(a) * r, 0.8, c.z + Math.sin(a) * r)
      bs.push(rng(), 0.5 + rng() * 0.9, c.h - 1.3, 0.6 + rng() * 0.8)
    }
  }
  for (const cx of BED_X) {
    for (const [z0, z1] of BED_Z) {
      const nb = Math.round((z1 - z0) * 2.2 * density)
      for (let k = 0; k < nb; k++) {
        bp.push(cx + (rng() - 0.5) * BED_HALF * 1.6, WATER_Y - 0.45, z0 + 0.3 + rng() * (z1 - z0 - 0.6))
        bs.push(rng(), 0.25 + rng() * 0.35, 0.42, 0.35 + rng() * 0.45)
      }
    }
  }
  const bubbles = new THREE.BufferGeometry()
  bubbles.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3))
  bubbles.setAttribute('aB', new THREE.Float32BufferAttribute(bs, 4))
  bubbles.boundingSphere = new THREE.Sphere(new THREE.Vector3(90, 6, 33), 48)

  return { plants: g.build(), glow: glow.build(), tanks, bubbles, colliders, stalks }
}

const LAM_ROOT = new THREE.Color(0x4a6438)
const LAM_BODY = new THREE.Color(0x6f8f4e)
const LAM_TIP = new THREE.Color(0xb9d98a)
const LAM_GOLD = new THREE.Color(0xa89a4a)
const ACROSS = [-1, -0.42, 0, 0.42, 1] as const

// One laminaria strap: short stipe, long blade with a pale mid-rib and ruffled edges, dark at the root, light at the tip.
function laminaria(g: PlantGeo, rng: () => number, base: THREE.Vector3, L: number, grow: number): void {
  const s = sway(base, SWAY.ribbon, 0.55 + rng() * 0.25, rng() * 6.28, grow)
  const yaw = rng() * Math.PI * 2
  const leanA = rng() * Math.PI * 2
  const lean = 0.05 + rng() * 0.12
  const wMax = 0.22 + rng() * 0.14
  const twist = (rng() - 0.5) * 1.6
  const gold = rng() < 0.22 ? 0.45 : 0
  const hue = (rng() - 0.5) * 0.04
  const phase = rng() * 6.28
  const freq = 5.5 + rng() * 2.5
  const steps = Math.max(10, Math.round(L / 0.22))
  const p = new THREE.Vector3()
  const along = new THREE.Vector3()
  const side = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const c = new THREE.Color()
  const at = (u: number, out: THREE.Vector3) => out.set(
    base.x + Math.cos(leanA) * lean * L * u * u + Math.sin(u * 4 + phase) * 0.06 * u,
    base.y + L * u,
    base.z + Math.sin(leanA) * lean * L * u * u + Math.cos(u * 3.3 + phase) * 0.06 * u,
  )
  let prev: number[] | null = null
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    at(u, p)
    at(Math.min(1, u + 0.01), along).sub(at(Math.max(0, u - 0.01), nrm)).normalize()
    const a = yaw + twist * u
    side.set(Math.cos(a), 0, Math.sin(a))
    side.addScaledVector(along, -side.dot(along)).normalize()
    nrm.crossVectors(side, along).normalize()
    const stipe = 0.07
    const w = u < stipe ? 0.025 : wMax * Math.min(1, (u - stipe) / 0.1) * (1 - 0.7 * Math.pow(u, 1.6)) + 0.01
    c.copy(LAM_ROOT).lerp(LAM_BODY, Math.min(1, u / 0.35)).lerp(LAM_TIP, Math.max(0, (u - 0.35) / 0.65) * 0.85)
    if (gold) c.lerp(LAM_GOLD, gold * (1 - u * 0.5))
    c.offsetHSL(hue, 0, 0)
    const row: number[] = []
    for (const k of ACROSS) {
      const edge = Math.abs(k)
      const ruffle = edge * edge * (0.03 + 0.07 * u) * Math.sin(u * L * freq + phase + (k < 0 ? Math.PI : 0)) * (u < stipe ? 0 : 1)
      const x = p.x + side.x * w * k + nrm.x * ruffle
      const y = p.y + side.y * w * k + nrm.y * ruffle
      const z = p.z + side.z * w * k + nrm.z * ruffle
      const shade = k === 0 ? 1.16 : edge === 1 ? 1.08 : 0.9
      const vc = c.clone().multiplyScalar(shade)
      if (k === 0) vc.lerp(LAM_TIP, 0.12)
      row.push(g.vert(x, y, z, nrm.x + side.x * ruffle * 3, nrm.y, nrm.z + side.z * ruffle * 3, vc, s))
    }
    if (prev) for (let j = 0; j < ACROSS.length - 1; j++) g.quad(prev[j]!, prev[j + 1]!, row[j + 1]!, row[j]!)
    prev = row
  }
}

function kelpBlade(g: PlantGeo, rng: () => number, p: THREE.Vector3, out: THREE.Vector3, L: number): void {
  const s = sway(p, SWAY.upright, 0.8, rng() * 6.28)
  const pts: THREE.Vector3[] = []
  const w: number[] = []
  const sd: THREE.Vector3[] = []
  const c: THREE.Color[] = []
  const base = new THREE.Color([P.varech, P.laminaire, P.varechClair][Math.floor(rng() * 3)]!)
  const side = new THREE.Vector3(-out.z, 0, out.x)
  for (let k = 0; k <= 5; k++) {
    const u = k / 5
    pts.push(new THREE.Vector3(p.x + out.x * L * u * 0.7, p.y + L * u * 0.45 - L * u * u * 0.3, p.z + out.z * L * u * 0.7))
    w.push(0.2 * L * Math.sin(Math.min(1, u * 1.2) * Math.PI) + 0.01)
    sd.push(side)
    c.push(base.clone().multiplyScalar(0.8 + 0.4 * u))
  }
  g.ribbon(pts, w, sd, c, s)
}

function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (const p of parts) {
    const off = pos.length / 3
    const pa = p.getAttribute('position') as THREE.BufferAttribute
    const na = p.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i))
      nor.push(na.getX(i), na.getY(i), na.getZ(i))
    }
    const ix = p.index
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off)
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
