import * as THREE from 'three'
import type { ColliderTag, QualityLevel, Vec3 } from '../core/types'
import { PLANT_COLORS as P } from './palette'
import { PlantGeo, RIGID, SWAY } from './plantgeo'
import { cord, floorPlant, hangingBasket, kelpStalk, leafyCrown, railPlanter, sway } from './plants'
import type { ShapeSpec } from './ship'

// Les Serres live in gameplay's chambers (sites.ts): the greenhouse quay and the dôme tower, Drift-local.
export const SERRE_QUAI = { x0: 84, x1: 100, z0: 20, z1: 32, y0: 0, h: 5.5 } as const
export const SERRE_DOME = { x0: 70, x1: 80, z0: 40, z1: 50, y0: 0, h: 18 } as const

const BEDS = [
  { id: 'serre-bac-ouest', x0: 85, x1: 90.5, z0: 20.6, z1: 27.2, grow: 0 },
  { id: 'serre-bac-est', x0: 93.5, x1: 99, z0: 20.6, z1: 27.2, grow: 1 },
] as const
const SERRE_TINTS = [0x9fbf4a, 0xc9b85a, 0x7fa64a, 0xb5c86a] as const
const BED_H = 0.75
const BED_WATER = 0.62
const CHANNEL = { x0: 88, x1: 96, z0: 31.1, z1: 31.75, h: 0.3 }
const TANKS = [{ x: 86.1, z: 30.95 }, { x: 97.9, z: 30.95 }] as const
const TANK_R = 0.8
const TANK_H = 4.9
const CEIL = SERRE_QUAI.y0 + SERRE_QUAI.h - 0.05
export const SERRE_TRELLIS = [
  { id: 'serre-treille-nord', x: 71.4, z: 41.4, top: 17.4 },
  { id: 'serre-treille-sud', x: 78.6, z: 48.6, top: 17.4 },
] as const

export const SERRE_LAMPS: readonly Vec3[] = BEDS.flatMap((b) => [
  { x: (b.x0 + b.x1) / 2, y: 3.7, z: b.z0 + 1.8 },
  { x: (b.x0 + b.x1) / 2, y: 3.7, z: b.z1 - 1.8 },
])

export interface SerreBuild {
  plants: THREE.BufferGeometry
  glow: THREE.BufferGeometry
  lamps: THREE.BufferGeometry
  water: THREE.BufferGeometry
  tanks: THREE.BufferGeometry
  bubbles: THREE.BufferGeometry
  colliders: { spec: ShapeSpec; tag: ColliderTag }[]
  stalks: { base: Vec3; height: number }[]
}

function box(g: PlantGeo, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: number): void {
  const b = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.add(b, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Color(color), RIGID)
}

function waterQuad(pos: number[], uv: number[], idx: number[], x0: number, x1: number, y: number, z0: number, z1: number, kind: number): void {
  const s = pos.length / 3
  pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1)
  uv.push(x0, z0, kind, x1, z0, kind, x1, z1, kind, x0, z1, kind)
  idx.push(s, s + 2, s + 1, s, s + 3, s + 2)
}

export function buildSerres(rng: () => number, level: QualityLevel): SerreBuild {
  const g = new PlantGeo()
  const glow = new PlantGeo()
  const lamps = new PlantGeo()
  const colliders: SerreBuild['colliders'] = []
  const stalks: SerreBuild['stalks'] = []
  const density = level === 'high' ? 1 : level === 'medium' ? 0.7 : 0.45
  const prop = (spec: ShapeSpec, ownerId: string): void => {
    colliders.push({ spec, tag: { kind: 'prop', climbable: false, ownerId } })
  }

  for (const b of BEDS) {
    const t = 0.12
    box(g, b.x0, b.x1, 0, BED_H, b.z0, b.z0 + t, P.boisPlanche)
    box(g, b.x0, b.x1, 0, BED_H, b.z1 - t, b.z1, P.boisPlanche)
    box(g, b.x0, b.x0 + t, 0, BED_H, b.z0, b.z1, P.boisPlanche)
    box(g, b.x1 - t, b.x1, 0, BED_H, b.z0, b.z1, P.boisPlanche)
    box(g, b.x0 - 0.03, b.x1 + 0.03, BED_H - 0.08, BED_H, b.z0 - 0.03, b.z0 + 0.15, P.laiton)
    box(g, b.x0 - 0.03, b.x1 + 0.03, BED_H - 0.08, BED_H, b.z1 - 0.15, b.z1 + 0.03, P.laiton)
    box(g, b.x0 - 0.03, b.x0 + 0.15, BED_H - 0.08, BED_H, b.z0, b.z1, P.laiton)
    box(g, b.x1 - 0.15, b.x1 + 0.03, BED_H - 0.08, BED_H, b.z0, b.z1, P.laiton)
    for (let z = b.z0 + 3; z < b.z1 - 1; z += 6) {
      box(g, b.x0 - 0.06, b.x0 + 0.06, 0, BED_H + 0.05, z - 0.06, z + 0.06, P.boisOmbre)
      box(g, b.x1 - 0.06, b.x1 + 0.06, 0, BED_H + 0.05, z - 0.06, z + 0.06, P.boisOmbre)
    }
    prop({ shape: 'box', x: (b.x0 + b.x1) / 2, y: 0.275, z: (b.z0 + b.z1) / 2, hx: (b.x1 - b.x0) / 2, hy: 0.275, hz: (b.z1 - b.z0) / 2 }, b.id)
    const sp = 0.85 / Math.sqrt(density)
    for (let x = b.x0 + 0.5; x < b.x1 - 0.3; x += sp) {
      for (let z = b.z0 + 0.5; z < b.z1 - 0.3; z += sp) {
        const px = x + (rng() - 0.5) * sp * 0.8
        const pz = z + (rng() - 0.5) * sp * 0.8
        if (Math.abs(px - (b.x0 + b.x1) / 2) < 0.45 && rng() < 0.85) continue
        const h = 1.7 + rng() * 1.5 + Math.sin(pz * 0.9) * 0.3
        kelpStalk(g, rng, new THREE.Vector3(px, BED_WATER - 0.55, pz), h, { grow: b.grow, bladeLen: 0.95, tint: SERRE_TINTS[Math.floor(rng() * SERRE_TINTS.length)]! })
      }
    }
  }
  box(g, CHANNEL.x0 - 0.15, CHANNEL.x0, 0, CHANNEL.h, CHANNEL.z0, CHANNEL.z1, P.pierre)
  box(g, CHANNEL.x1, CHANNEL.x1 + 0.15, 0, CHANNEL.h, CHANNEL.z0, CHANNEL.z1, P.pierre)
  box(g, CHANNEL.x0, CHANNEL.x1, 0, 0.04, CHANNEL.z0, CHANNEL.z1, P.teal)
  box(g, CHANNEL.x0 - 0.15, CHANNEL.x1 + 0.15, 0, CHANNEL.h, CHANNEL.z0 - 0.15, CHANNEL.z0, P.pierre)
  for (let x = CHANNEL.x0 + 0.4; x < CHANNEL.x1; x += 0.8) {
    leafyCrown(g, rng, new THREE.Vector3(x + (rng() - 0.5) * 0.3, 0.05, (CHANNEL.z0 + CHANNEL.z1) / 2), 5, 0.4, { kind: SWAY.ribbon, spread: 0.3, droop: 0.1, greens: [P.herbe, P.feuilleClaire, P.fougere] })
  }

  for (const [i, t] of TANKS.entries()) {
    const ring = (y: number, r: number, h: number) => {
      const c = new THREE.CylinderGeometry(r, r, h, 24, 1, true)
      g.add(c, new THREE.Matrix4().makeTranslation(t.x, y, t.z), new THREE.Color(P.laiton), RIGID)
      const top = new THREE.RingGeometry(TANK_R - 0.05, r, 24)
      top.rotateX(-Math.PI / 2)
      g.add(top, new THREE.Matrix4().makeTranslation(t.x, y + h / 2, t.z), new THREE.Color(P.laiton), RIGID)
    }
    ring(0.3, TANK_R + 0.12, 0.6)
    ring(TANK_H - 0.12, TANK_R + 0.1, 0.24)
    ring(TANK_H * 0.5, TANK_R + 0.04, 0.1)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      box(g, t.x + Math.cos(a) * (TANK_R + 0.03) - 0.04, t.x + Math.cos(a) * (TANK_R + 0.03) + 0.04, 0.6, TANK_H - 0.2, t.z + Math.sin(a) * (TANK_R + 0.03) - 0.04, t.z + Math.sin(a) * (TANK_R + 0.03) + 0.04, P.laiton)
    }
    const sand = new THREE.CircleGeometry(TANK_R - 0.02, 20)
    sand.rotateX(-Math.PI / 2)
    g.add(sand, new THREE.Matrix4().makeTranslation(t.x, 0.62, t.z), new THREE.Color(0xe8d6a8), RIGID)
    const n = Math.round(7 * Math.max(0.6, density))
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * (TANK_R - 0.45)
      kelpStalk(g, rng, new THREE.Vector3(t.x + Math.cos(a) * r, 0.62, t.z + Math.sin(a) * r), 2.9 + rng() * 1.2, { grow: 2, bladeLen: 0.8, flex: 0.8, tint: SERRE_TINTS[Math.floor(rng() * SERRE_TINTS.length)]! })
    }
    for (let k = 0; k < 9; k++) {
      const a = rng() * Math.PI * 2
      const r = rng() * (TANK_R - 0.3)
      const base = new THREE.Vector3(t.x + Math.cos(a) * r, 0.62, t.z + Math.sin(a) * r)
      const y = 1.0 + rng() * 3.4
      const sph = new THREE.IcosahedronGeometry(0.03 + rng() * 0.03, 1)
      glow.add(sph, new THREE.Matrix4().makeTranslation(base.x, y, base.z), new THREE.Color(P.bio1), sway(base, SWAY.ribbon, 0.7, rng() * 6.28, 2))
    }
    prop({ shape: 'cyl', x: t.x, y: TANK_H / 2, z: t.z, r: TANK_R + 0.1, hh: TANK_H / 2 }, `serre-cuve-${i}`)
  }

  for (const tr of SERRE_TRELLIS) {
    const R = 0.55
    const steps = 18
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      cord(g, new THREE.Vector3(tr.x + Math.cos(a) * R, 0, tr.z + Math.sin(a) * R), new THREE.Vector3(tr.x + Math.cos(a) * R * 0.8, tr.top, tr.z + Math.sin(a) * R * 0.8), 0.025, P.corde)
    }
    for (let y = 0.6; y < tr.top; y += 0.9) {
      const ringG = new THREE.TorusGeometry(R - 0.02, 0.018, 3, 12)
      ringG.rotateX(Math.PI / 2)
      g.add(ringG, new THREE.Matrix4().makeTranslation(tr.x, y, tr.z), new THREE.Color(P.corde), RIGID)
    }
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI * 2
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= steps * 4; i++) {
        const u = i / (steps * 4)
        const a = a0 + u * Math.PI * 6
        pts.push(new THREE.Vector3(tr.x + Math.cos(a) * (R + 0.04), u * tr.top, tr.z + Math.sin(a) * (R + 0.04)))
      }
      const sides = pts.map(() => new THREE.Vector3(0, 1, 0))
      const c = new THREE.Color(P.stipe)
      g.ribbon(pts, pts.map(() => 0.09), sides, pts.map((_, i) => c.clone().multiplyScalar(0.8 + 0.4 * (i / pts.length))), RIGID)
      for (let i = 4; i < pts.length; i += 3) {
        const p = pts[i]!
        const out = new THREE.Vector3(p.x - tr.x, 0, p.z - tr.z).normalize()
        kelpBlade(g, rng, p, out, 0.6 + rng() * 0.5)
      }
    }
    leafyCrown(g, rng, new THREE.Vector3(tr.x, tr.top, tr.z), 9, 1.6, { kind: SWAY.hang, spread: 0.9, droop: 1.3, greens: [P.varechClair, P.laminaire, P.varech], width: 0.14 })
    colliders.push({ spec: { shape: 'capsule', x: tr.x, y: tr.top / 2, z: tr.z, r: R + 0.05, hh: tr.top / 2 - R }, tag: { kind: 'kelp', climbable: true, ownerId: tr.id } })
    stalks.push({ base: { x: tr.x, y: 0, z: tr.z }, height: tr.top })
  }

  for (const l of SERRE_LAMPS) {
    const top = new THREE.Vector3(l.x, CEIL, l.z)
    const at = new THREE.Vector3(l.x, l.y + 0.35, l.z)
    cord(lamps, top, at, 0.012, P.boisOmbre, sway(top, SWAY.hang, 0.25, l.z))
    const shade = new THREE.ConeGeometry(0.42, 0.32, 12, 1, true)
    g.add(shade, new THREE.Matrix4().makeTranslation(l.x, l.y + 0.2, l.z), new THREE.Color(P.laiton), sway(top, SWAY.hang, 0.25, l.z))
    const bulb = new THREE.SphereGeometry(0.16, 10, 6)
    lamps.add(bulb, new THREE.Matrix4().makeTranslation(l.x, l.y, l.z), new THREE.Color(0xf4ffd8), sway(top, SWAY.hang, 0.25, l.z))
  }

  for (const x of [88.2, 95.8]) hangingBasket(g, rng, new THREE.Vector3(x, CEIL, 29), 1.0, 0.22, 6, 1.1)
  for (const [x, z, sc] of [[90.95, 20.75, 0.95], [93.05, 20.75, 0.95], [84.5, 27.75, 0.9], [99.5, 27.75, 0.9], [92, 31.4, 0.7]] as const) {
    floorPlant(g, rng, x, 0, z, sc)
    prop({ shape: 'cyl', x, y: 0.2 * sc, z, r: 0.24 * sc, hh: 0.2 * sc }, 'serre-pot')
  }

  const D = SERRE_DOME
  const dTop = D.y0 + D.h - 0.6
  for (const [x, z, alongZ, ox, oz] of [
    [D.x0 + 0.25, 45.5, true, 1, 0], [D.x1 - 0.25, 43.5, true, -1, 0],
    [74.5, D.z0 + 0.25, false, 0, 1], [76, D.z1 - 0.25, false, 0, -1],
  ] as const) {
    railPlanterTall(g, rng, x, dTop, z, alongZ, ox, oz, density)
  }
  for (const [x, z] of [[D.x1 - 0.7, D.z0 + 0.7], [D.x0 + 0.7, D.z1 - 0.7]] as const) {
    floorPlant(g, rng, x, D.y0, z, 1.4)
    prop({ shape: 'cyl', x, y: D.y0 + 0.28, z, r: 0.34, hh: 0.28 }, 'serre-pot')
  }

  const wp: number[] = []
  const wu: number[] = []
  const wi: number[] = []
  for (const b of BEDS) waterQuad(wp, wu, wi, b.x0 + 0.12, b.x1 - 0.12, BED_WATER, b.z0 + 0.12, b.z1 - 0.12, 0)
  waterQuad(wp, wu, wi, CHANNEL.x0, CHANNEL.x1, CHANNEL.h - 0.06, CHANNEL.z0, CHANNEL.z1, 1)
  const water = new THREE.BufferGeometry()
  water.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3))
  water.setAttribute('aW', new THREE.Float32BufferAttribute(wu, 3))
  water.setIndex(wi)
  water.computeBoundingSphere()

  const tankParts: THREE.BufferGeometry[] = []
  for (const t of TANKS) {
    const c = new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H - 0.6, 32, 1, true)
    c.translate(t.x, 0.6 + (TANK_H - 0.6) / 2, t.z)
    tankParts.push(c)
  }
  const tanks = mergeSimple(tankParts)

  const bp: number[] = []
  const bs: number[] = []
  const nb = Math.round(60 * density)
  for (const t of TANKS) {
    for (let k = 0; k < nb; k++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * (TANK_R - 0.25)
      bp.push(t.x + Math.cos(a) * r, 0.7, t.z + Math.sin(a) * r)
      bs.push(rng(), 0.5 + rng() * 0.9, TANK_H - 1.0, 0.6 + rng() * 0.8)
    }
  }
  for (const b of BEDS) {
    for (let k = 0; k < nb * 2; k++) {
      bp.push(b.x0 + 0.3 + rng() * (b.x1 - b.x0 - 0.6), 0.1, b.z0 + 0.3 + rng() * (b.z1 - b.z0 - 0.6))
      bs.push(rng(), 0.3 + rng() * 0.4, BED_WATER - 0.12, 0.4 + rng() * 0.5)
    }
  }
  const bubbles = new THREE.BufferGeometry()
  bubbles.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3))
  bubbles.setAttribute('aB', new THREE.Float32BufferAttribute(bs, 4))
  bubbles.boundingSphere = new THREE.Sphere(new THREE.Vector3(82, 5, 29), 40)

  return { plants: g.build(), glow: glow.build(), lamps: lamps.build(), water, tanks, bubbles, colliders, stalks }
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

function railPlanterTall(g: PlantGeo, rng: () => number, x: number, y: number, z: number, alongZ: boolean, ox: number, oz: number, density: number): void {
  railPlanter(g, rng, x, y, z, alongZ, 2.6, ox, oz, 7.5 * Math.max(0.6, density))
  railPlanter(g, rng, x, y - 6.5, z + (alongZ ? 1.2 : 0), alongZ, 1.8, ox, oz, 4.5)
}
