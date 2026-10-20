import * as THREE from 'three'
import { DISTRICT_BY_ID, DRIFT_BOUNDS, districtAt } from '../core/layout'
import type { ColliderKind, DistrictId, QualityLevel, Vec3 } from '../core/types'
import { PLANT_COLORS as P } from './palette'
import { PlantGeo, SWAY } from './plantgeo'
import { sway } from './plants'
import type { ShipFrame } from './ship'

const HULL_KINDS: ReadonlySet<ColliderKind> = new Set(['hull', 'hull-outside', 'interior', 'wall', 'floor', 'glass', 'window'])
const KEEL_STEP: Record<QualityLevel, number> = { high: 4, medium: 5.5, low: 8 }
const SWAY_REACH = 4
const TILE = 40

type Raycast = (origin: Vec3, dir: Vec3, max: number) => { point: Vec3; normal: Vec3; kind: ColliderKind | undefined } | null

// The coat: weed beards under the keels and tufts on the flanks. "Anything that sits still in the sea grows a coat."
export class HullCoat {
  readonly group = new THREE.Group()
  private readonly done = new Set<DistrictId>()

  constructor(private readonly material: THREE.Material) {
    this.group.name = 'flora-manteau'
    this.group.matrixAutoUpdate = false
  }

  has(d: DistrictId): boolean {
    return this.done.has(d)
  }

  scan(id: DistrictId, ship: ShipFrame, raycast: Raycast, rng: () => number, level: QualityLevel): number {
    if (this.done.has(id) || id === 'hauts') return 0
    const d = DISTRICT_BY_ID[id]
    const tiles = new Map<string, PlantGeo>()
    const tile = (at: THREE.Vector3): PlantGeo => {
      const key = `${Math.floor(at.x / TILE)},${Math.floor(at.z / TILE)}`
      let g = tiles.get(key)
      if (!g) tiles.set(key, (g = new PlantGeo()))
      return g
    }
    const step = KEEL_STEP[level]
    const c = Math.cos(ship.heading)
    const s = Math.sin(ship.heading)
    const dirW = (x: number, y: number, z: number): Vec3 => ({ x: x * c - z * s, y, z: x * s + z * c })
    let hits = 0
    const accept = (h: ReturnType<Raycast>): Vec3 | null => {
      if (!h || (h.kind && !HULL_KINDS.has(h.kind))) return null
      const l = ship.toLocal(h.point, { x: 0, y: 0, z: 0 })
      return districtAt(l) === id ? l : null
    }
    for (let x = d.x0 + step / 2; x < d.x1; x += step) {
      for (let z = d.z0 + step / 2; z < d.z1; z += step) {
        const px = x + (rng() - 0.5) * step * 0.7
        const pz = z + (rng() - 0.5) * step * 0.7
        const o = ship.toWorld({ x: px, y: DRIFT_BOUNDS.y0 - 16, z: pz })
        const h = raycast(o, { x: 0, y: 1, z: 0 }, 60)
        if (!h || h.normal.y > -0.2) continue
        const l = accept(h)
        if (!l) continue
        hits++
        const n = 3 + Math.floor(rng() * 4)
        for (let k = 0; k < n; k++) {
          const at = new THREE.Vector3(l.x + (rng() - 0.5) * 1.8, l.y + 0.05, l.z + (rng() - 0.5) * 1.2)
          beard(tile(at), rng, at, 1.6 + rng() * 3.6)
        }
      }
    }
    const flank = (x0: number, z0: number, dx: number, dz: number, along: 'x' | 'z', lo: number, hi: number) => {
      for (let t = lo; t < hi; t += step * 1.2) {
        for (let y = d.y0 + 2; y < d.y1; y += 4) {
          if (rng() < 0.4) continue
          const tt = t + (rng() - 0.5) * step
          const lx = along === 'z' ? x0 : tt
          const lz = along === 'z' ? tt : z0
          const o = ship.toWorld({ x: lx, y: y + (rng() - 0.5) * 2, z: lz })
          const h = raycast(o, dirW(dx, 0, dz), 40)
          const l = accept(h)
          if (!l) continue
          hits++
          const n = 1 + Math.floor(rng() * 3)
          for (let k = 0; k < n; k++) {
            const at = new THREE.Vector3(l.x - dx * 0.06 + (along === 'x' ? (rng() - 0.5) * 1.2 : 0), l.y - rng() * 0.6, l.z - dz * 0.06 + (along === 'z' ? (rng() - 0.5) * 1.2 : 0))
            beard(tile(at), rng, at, 0.5 + rng() * 1.6)
          }
        }
      }
    }
    const B = DRIFT_BOUNDS
    if (d.x0 <= B.x0 + 1) flank(B.x0 - 14, 0, 1, 0, 'z', d.z0, d.z1)
    if (d.x1 >= B.x1 - 1) flank(B.x1 + 14, 0, -1, 0, 'z', d.z0, d.z1)
    if (d.z0 <= B.z0 + 1) flank(0, B.z0 - 14, 0, 1, 'x', d.x0, d.x1)
    if (d.z1 >= B.z1 - 1) flank(0, B.z1 + 14, 0, -1, 'x', d.x0, d.x1)
    if (hits === 0) return 0
    this.done.add(id)
    for (const [key, g] of tiles) {
      const geo = g.build()
      geo.computeBoundingBox()
      geo.computeBoundingSphere()
      geo.boundingBox!.expandByScalar(SWAY_REACH)
      geo.boundingSphere!.radius += SWAY_REACH
      const mesh = new THREE.Mesh(geo, this.material)
      mesh.name = `flora-manteau-${id}:${key}`
      mesh.matrixAutoUpdate = false
      this.group.add(mesh)
    }
    return hits
  }

  dispose(): void {
    for (const m of this.group.children) (m as THREE.Mesh).geometry.dispose()
    this.group.removeFromParent()
  }
}

const BEARD = [P.barbe, P.barbeClaire, P.varech, P.feuilleSombre, P.laminaire]

function beard(g: PlantGeo, rng: () => number, at: THREE.Vector3, len: number): void {
  const s = sway(at, SWAY.trail, 0.8 + rng() * 0.4, rng() * 6.28, 3)
  const steps = Math.max(4, Math.round(len / 0.35))
  const a = rng() * Math.PI * 2
  const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
  const pts: THREE.Vector3[] = []
  const w: number[] = []
  const sd: THREE.Vector3[] = []
  const cols: THREE.Color[] = []
  const base = new THREE.Color(BEARD[Math.floor(rng() * BEARD.length)]!)
  const width = 0.16 + rng() * 0.3
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push(new THREE.Vector3(at.x + Math.sin(t * 4 + a) * 0.06, at.y - t * len, at.z + Math.cos(t * 3 + a) * 0.06))
    w.push(width * (0.5 + Math.sin(Math.min(1, t * 1.3) * Math.PI) * 0.8) * (1 - t * 0.6) + 0.01)
    sd.push(side)
    cols.push(base.clone().multiplyScalar(0.55 + 0.6 * t))
  }
  g.ribbon(pts, w, sd, cols, s)
  if (rng() < 0.5) {
    const b2 = side.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2)
    g.ribbon(pts.map((p, i) => p.clone().add(b2.clone().multiplyScalar(0.05 * i / steps))), w.map((x) => x * 0.6), pts.map(() => b2), cols, s)
  }
}
