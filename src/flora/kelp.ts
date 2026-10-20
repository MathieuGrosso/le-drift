import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { CEILING_Y, HAUTS_FONDS, REGIONS, SONDES } from '../core/layout'
import type { GameContext, PhysicsWorld, Vec3 } from '../core/types'
import { kelpGeometry } from './geometry'
import { blancFactor, distanceToDriftRoute, forestEdge, forestFactor, grassDensity, ventFactor, type Ground } from './ground'
import { InstanceBounds, InstanceBuffers, makeMesh, RECORD } from './instances'
import { cellRng, fbm } from './noise'
import { FLORA_COLORS } from './palette'

const GRID = 32
const STALK_RADIUS = 0.35
const KELP_REACH = 10

export interface KelpLodSpec {
  r0: number
  cap0: number
  r1: number
  cap1: number
}

export const KELP_LOD: Record<'low' | 'medium' | 'high', KelpLodSpec> = {
  high: { r0: 85, cap0: 320, r1: 190, cap1: 2000 },
  medium: { r0: 60, cap0: 200, r1: 150, cap1: 1400 },
  low: { r0: 42, cap0: 120, r1: 110, cap1: 900 },
}

export class KelpField {
  readonly group = new THREE.Group()
  readonly data: Float32Array
  readonly count: number
  private readonly grid = new Map<number, number[]>()
  private readonly lods: { buf: InstanceBuffers; bounds: InstanceBounds; geo: THREE.InstancedBufferGeometry; mesh: THREE.Mesh }[] = []
  private spec: KelpLodSpec
  private readonly close: number[] = []
  private readonly frustum = new THREE.Frustum()
  private readonly projView = new THREE.Matrix4()
  private readonly sphere = new THREE.Sphere()
  private readonly colliders = new Map<number, RAPIER.Collider>()
  private lastColliderPos = { x: Number.NaN, z: Number.NaN }

  constructor(ground: Ground, materials: THREE.Material[], spec: KelpLodSpec) {
    const records = placeKelp(ground)
    this.count = records.length / RECORD
    this.data = Float32Array.from(records)
    for (let i = 0; i < this.count; i++) {
      const k = gridKey(this.data[i * RECORD]!, this.data[i * RECORD + 2]!)
      let list = this.grid.get(k)
      if (!list) this.grid.set(k, (list = []))
      list.push(i)
    }
    const rng = cellRng(1, 2, 999)
    for (let lod = 0; lod < 3; lod++) {
      const geo = kelpGeometry(lod as 0 | 1 | 2, rng)
      const buf = new InstanceBuffers(Math.max(1, this.count), geo)
      const mesh = makeMesh(geo, materials[lod]!, `flora-kelp-lod${lod}`)
      this.group.add(mesh)
      this.lods.push({ buf, bounds: new InstanceBounds(geo), geo, mesh })
    }
    this.spec = spec
  }

  setSpec(spec: KelpLodSpec): void {
    this.spec = spec
  }

  updateLod(camera: THREE.PerspectiveCamera): void {
    camera.updateMatrixWorld()
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this.frustum.setFromProjectionMatrix(this.projView)
    const cx = camera.position.x
    const cz = camera.position.z
    const r0sq = this.spec.r0 * this.spec.r0
    const r1sq = this.spec.r1 * this.spec.r1
    const counts = [0, 0, 0]
    const d = this.data
    const close = this.close
    close.length = 0
    for (const l of this.lods) l.bounds.reset()
    for (let i = 0; i < this.count; i++) {
      const o = i * RECORD
      const x = d[o]!
      const z = d[o + 2]!
      const h = d[o + 5]!
      this.sphere.center.set(x, d[o + 1]! + h * 0.5, z)
      this.sphere.radius = h * 0.5 + 10
      if (!this.frustum.intersectsSphere(this.sphere)) continue
      const dx = x - cx
      const dz = z - cz
      const dsq = dx * dx + dz * dz
      if (dsq < r0sq) {
        close.push(dsq, i)
        continue
      }
      this.place(dsq < r1sq ? 1 : 2, i, counts)
    }
    const n = close.length / 2
    if (n > this.spec.cap0) {
      const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => close[a * 2]! - close[b * 2]!)
      for (let k = 0; k < n; k++) this.place(k < this.spec.cap0 ? 0 : 1, close[order[k]! * 2 + 1]!, counts)
    } else {
      for (let k = 0; k < n; k++) this.place(0, close[k * 2 + 1]!, counts)
    }
    for (let lod = 0; lod < 3; lod++) {
      const l = this.lods[lod]!
      l.geo.instanceCount = counts[lod]!
      l.buf.uploadAll(counts[lod]!)
      l.bounds.commit()
    }
  }

  private place(lod: number, i: number, counts: number[]): void {
    if (lod === 1 && counts[1]! >= this.spec.cap1) lod = 2
    const l = this.lods[lod]!
    l.buf.copyFrom(this.data, i, counts[lod]!)
    const o = i * RECORD
    l.bounds.add(this.data[o]!, this.data[o + 1]!, this.data[o + 1]! + this.data[o + 5]!, this.data[o + 2]!, KELP_REACH)
    counts[lod]!++
  }

  near(p: Vec3, r: number): { base: Vec3; height: number; index: number }[] {
    const out: { base: Vec3; height: number; index: number }[] = []
    const g0x = Math.floor((p.x - r) / GRID)
    const g1x = Math.floor((p.x + r) / GRID)
    const g0z = Math.floor((p.z - r) / GRID)
    const g1z = Math.floor((p.z + r) / GRID)
    const rsq = r * r
    for (let gx = g0x; gx <= g1x; gx++) {
      for (let gz = g0z; gz <= g1z; gz++) {
        const list = this.grid.get(gx * 100003 + gz)
        if (!list) continue
        for (const i of list) {
          const o = i * RECORD
          const dx = this.data[o]! - p.x
          const dz = this.data[o + 2]! - p.z
          if (dx * dx + dz * dz > rsq) continue
          out.push({
            base: { x: this.data[o]!, y: this.data[o + 1]!, z: this.data[o + 2]! },
            height: this.data[o + 5]!,
            index: i,
          })
        }
      }
    }
    return out
  }

  updateColliders(physics: PhysicsWorld, hero: Vec3, enabled: boolean): void {
    const moved = Math.hypot(hero.x - this.lastColliderPos.x, hero.z - this.lastColliderPos.z)
    if (enabled && moved < 5) return
    this.lastColliderPos = { x: hero.x, z: hero.z }
    const want = new Set<number>()
    if (enabled) {
      const list = this.near(hero, 36)
      list.sort((a, b) => Math.hypot(a.base.x - hero.x, a.base.z - hero.z) - Math.hypot(b.base.x - hero.x, b.base.z - hero.z))
      for (let i = 0; i < list.length && i < 48; i++) want.add(list[i]!.index)
    }
    for (const [i, c] of this.colliders) {
      if (want.has(i)) continue
      physics.untag(c)
      physics.world.removeCollider(c, false)
      this.colliders.delete(i)
    }
    const { rapier, groups } = physics
    const membership = groups.TERRAIN
    const filter = groups.HERO | groups.FAUNA
    for (const i of want) {
      if (this.colliders.has(i)) continue
      const o = i * RECORD
      const h = this.data[o + 5]!
      const desc = rapier.ColliderDesc.capsule(Math.max(0.1, h * 0.5 - STALK_RADIUS), STALK_RADIUS)
        .setTranslation(this.data[o]!, this.data[o + 1]! + h * 0.5, this.data[o + 2]!)
        .setCollisionGroups(((membership & 0xffff) << 16) | (filter & 0xffff))
      const c = physics.world.createCollider(desc)
      physics.tag(c, { kind: 'kelp', climbable: true, ownerId: `kelp-${i}` })
      this.colliders.set(i, c)
    }
  }

  clearColliders(physics: PhysicsWorld): void {
    for (const c of this.colliders.values()) {
      physics.untag(c)
      physics.world.removeCollider(c, false)
    }
    this.colliders.clear()
  }

  dispose(ctx: GameContext): void {
    this.clearColliders(ctx.physics)
    for (const l of this.lods) l.geo.dispose()
    this.group.removeFromParent()
  }
}

function gridKey(x: number, z: number): number {
  return Math.floor(x / GRID) * 100003 + Math.floor(z / GRID)
}

const KELP_TINTS = [FLORA_COLORS.laminaire, FLORA_COLORS.laminaireClair, 0xb08a34, 0xcfa246, 0xa98f3c]

function placeKelp(ground: Ground): number[] {
  const out: number[] = []
  const rng = cellRng(17, 23, 4401)
  const col = new THREE.Color()
  const push = (x: number, z: number, height: number, width: number) => {
    if (ground.outside(x, z)) return
    if (ground.upness(x, z) < 0.65) return
    const y = ground.height(x, z) - 0.4
    const h = Math.min(height, CEILING_Y - 5 - y)
    if (h < 4) return
    col.setHex(KELP_TINTS[Math.floor(rng() * KELP_TINTS.length)]!)
    const j = 0.9 + rng() * 0.2
    out.push(x, y, z, rng() * Math.PI * 2, width, h, rng() * 6.283, col.r * j, col.g * j, col.b * j)
  }

  const L = REGIONS.laminaires
  const step = 7
  for (let x = L.x - 380; x <= L.x + 380; x += step) {
    for (let z = L.z - 380; z <= L.z + 380; z += step) {
      const px = x + (rng() - 0.5) * step * 0.9
      const pz = z + (rng() - 0.5) * step * 0.9
      const f = forestFactor(px, pz)
      if (f <= 0.01) continue
      const clearing = fbm(px / 85, pz / 85, 606)
      const edge = forestEdge(px, pz)
      const p = f * (clearing > 0.6 ? 0.08 : 0.42) + edge * 0.3
      if (rng() > p) continue
      const base = 30 + 40 * fbm(px / 60, pz / 60, 607)
      const wall = edge * (60 + rng() * 15)
      push(px, pz, Math.max(base * (0.75 + rng() * 0.35), wall), 0.9 + rng() * 0.4)
    }
  }

  for (let c = 0; c < 170; c++) {
    const cx = (rng() * 2 - 1) * 960
    const cz = (rng() * 2 - 1) * 960
    if (forestFactor(cx, cz) > 0.2 || blancFactor(cz) > 0.2 || ventFactor(cx, cz) > 0.3) continue
    const y = ground.height(cx, cz)
    if (grassDensity(cx, cz, y, ground.upness(cx, cz)) < 0.15 && rng() < 0.7) continue
    const routeD = distanceToDriftRoute(cx, cz)
    const n = 4 + Math.floor(rng() * 10)
    const maxH = routeD < 160 ? Math.max(6, 36 - y) : 30
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(rng()) * 9
      push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.min(maxH, 10 + rng() * 18), 0.8 + rng() * 0.3)
    }
  }

  const sonde = SONDES.find((s) => s.id === 'sonde-laminaires')
  if (sonde) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + rng() * 0.3
      const r = 6 + rng() * 10
      const x = sonde.x + Math.cos(a) * r
      const z = sonde.z + Math.sin(a) * r
      push(x, z, sonde.topY - 3 + rng() * 4 - ground.height(x, z), 1.1)
    }
  }
  const hf = HAUTS_FONDS.find((h) => h.rule === 'kelp-timing')
  if (hf) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2
      const r = 10 + rng() * 10
      const x = hf.x + Math.cos(a) * r
      const z = hf.z + Math.sin(a) * r
      push(x, z, 14 + rng() * 10, 1.1)
    }
  }
  return out
}
