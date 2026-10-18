import * as THREE from 'three'
import { CEILING_Y, DRIFT_BOUNDS } from '../core/layout'
import type { GameContext, QualityLevel, Vec3 } from '../core/types'
import { PLANT_COLORS as P } from './palette'
import { PlantGeo, SWAY } from './plantgeo'
import { kelpStalk, sway } from './plants'

const COUNTS: Record<QualityLevel, { fronds: number; rafts: number }> = {
  high: { fronds: 70, rafts: 34 },
  medium: { fronds: 45, rafts: 22 },
  low: { fronds: 22, rafts: 12 },
}

interface Body {
  p: THREE.Vector3
  v: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  scale: number
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()

function frondGeometry(rng: () => number): THREE.BufferGeometry {
  const g = new PlantGeo()
  const base = new THREE.Vector3(0, -1.6, 0)
  for (let k = 0; k < 3; k++) {
    kelpStalk(g, rng, base.clone().add(new THREE.Vector3((rng() - 0.5) * 0.2, 0, (rng() - 0.5) * 0.2)), 2.6 + rng() * 1.4, { tint: [P.laminaire, P.varech, P.varechClair][k], bladeLen: 0.8 })
  }
  const hold = new THREE.IcosahedronGeometry(0.22, 0)
  g.add(hold, new THREE.Matrix4().makeTranslation(0, -1.65, 0), new THREE.Color(P.stipe), sway(base, SWAY.ribbon, 1, 0))
  return g.build()
}

function raftGeometry(rng: () => number): THREE.BufferGeometry {
  const g = new PlantGeo()
  const c = new THREE.Vector3(0, 0, 0)
  const greens = [P.sargasse, P.varechClair, P.laminaire]
  for (let i = 0; i < 48; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * 1.6
    const p = new THREE.Vector3(Math.cos(a) * r, (rng() - 0.5) * 0.25, Math.sin(a) * r)
    const L = 0.5 + rng() * 0.6
    const dir = new THREE.Vector3(Math.cos(a + rng()), 0, Math.sin(a + rng()))
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const col = new THREE.Color(greens[Math.floor(rng() * greens.length)]!)
    const pts = [p, p.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3(0, 0.05, 0)), p.clone().addScaledVector(dir, L)]
    g.ribbon(pts, [0.05, 0.22, 0.03], [side, side, side], [col.clone().multiplyScalar(0.8), col, col.clone().multiplyScalar(1.1)], sway(c, SWAY.upright, 0.6, rng() * 6.28))
    if (rng() < 0.7) {
      const b = new THREE.IcosahedronGeometry(0.05 + rng() * 0.04, 0)
      g.add(b, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z), new THREE.Color(P.flotteur), sway(c, SWAY.upright, 0.6, 0))
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2
    const r = Math.sqrt(rng()) * 1.3
    const top = new THREE.Vector3(Math.cos(a) * r, -0.05, Math.sin(a) * r)
    const len = 0.8 + rng() * 2.2
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3(top.x + Math.sin(k + a) * 0.08, top.y - (k / 6) * len, top.z + Math.cos(k * 0.7 + a) * 0.08))
    const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const col = new THREE.Color(P.sargasse).multiplyScalar(0.7)
    g.ribbon(pts, pts.map((_, k) => 0.09 * (1 - k / 7)), pts.map(() => side), pts.map((_, k) => col.clone().multiplyScalar(1 - k * 0.06)), sway(top, SWAY.hang, 1.6, rng() * 6.28))
  }
  return g.build()
}

// Loose fronds tumbling past the windows at the Drift's depth, and sargasso rafts floating under the ceiling.
export class Drifters {
  readonly group = new THREE.Group()
  private fronds: THREE.InstancedMesh
  private rafts: THREE.InstancedMesh
  private readonly fb: Body[] = []
  private readonly rb: Body[] = []

  constructor(private readonly ctx: GameContext, material: THREE.Material, rng: () => number, level: QualityLevel) {
    this.group.name = 'flora-derive'
    const c = COUNTS.high
    this.fronds = new THREE.InstancedMesh(frondGeometry(rng), material, c.fronds)
    this.rafts = new THREE.InstancedMesh(raftGeometry(rng), material, c.rafts)
    for (const m of [this.fronds, this.rafts]) {
      m.frustumCulled = false
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.userData.noShadow = true
      this.group.add(m)
    }
    for (let i = 0; i < c.fronds; i++) this.fb.push(this.body(rng))
    for (let i = 0; i < c.rafts; i++) this.rb.push(this.body(rng))
    this.setQuality(level)
  }

  private body(rng: () => number): Body {
    return {
      p: new THREE.Vector3(0, -1e4, 0),
      v: new THREE.Vector3(),
      rot: new THREE.Euler(rng() * 6.28, rng() * 6.28, rng() * 6.28),
      spin: new THREE.Vector3((rng() - 0.5) * 0.3, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.3),
      scale: 0.7 + rng() * 0.7,
    }
  }

  setQuality(level: QualityLevel): void {
    this.fronds.count = COUNTS[level].fronds
    this.rafts.count = COUNTS[level].rafts
  }

  private insideDrift(p: THREE.Vector3, margin: number): boolean {
    const drift = this.ctx.services.drift
    if (!drift) return false
    const l = drift.toLocal(p)
    const B = DRIFT_BOUNDS
    return l.x > B.x0 - margin && l.x < B.x1 + margin && l.z > B.z0 - margin && l.z < B.z1 + margin && l.y > B.y0 - margin && l.y < B.y1 + margin
  }

  private floor(x: number, z: number): number {
    return this.ctx.services.world?.heightAt(x, z) ?? 0
  }

  private spawnFrond(b: Body, cam: THREE.Vector3, rng: () => number, anywhere: boolean): void {
    const driftY = this.ctx.state.drift.position.y
    for (let tries = 0; tries < 8; tries++) {
      const a = rng() * Math.PI * 2
      const r = anywhere ? 25 + Math.sqrt(rng()) * 115 : 110 + rng() * 30
      const x = cam.x + Math.cos(a) * r
      const z = cam.z + Math.sin(a) * r
      const y = Math.min(CEILING_Y - 4, Math.max(this.floor(x, z) + 5, driftY - 30 + rng() * 60))
      b.p.set(x, y, z)
      if (!this.insideDrift(b.p, 8)) return
    }
    b.p.y = -1e4
  }

  private spawnRaft(b: Body, cam: THREE.Vector3, rng: () => number, anywhere: boolean): void {
    const a = rng() * Math.PI * 2
    const r = anywhere ? 20 + Math.sqrt(rng()) * 200 : 190 + rng() * 30
    b.p.set(cam.x + Math.cos(a) * r, CEILING_Y - 1.0 - rng() * 2.5, cam.z + Math.sin(a) * r)
    b.rot.set((rng() - 0.5) * 0.2, rng() * 6.28, (rng() - 0.5) * 0.2)
  }

  update(dt: number, cam: THREE.Vector3, rng: () => number, current: Vec3): void {
    const t = this.ctx.clock.elapsed
    const fCount = this.fronds.count
    for (let i = 0; i < fCount; i++) {
      const b = this.fb[i]!
      const dx = b.p.x - cam.x
      const dz = b.p.z - cam.z
      const far = dx * dx + dz * dz > 150 * 150 || b.p.y < -1e3
      if (far) this.spawnFrond(b, cam, rng, b.p.y < -1e3)
      else if ((i + this.ctx.clock.frame) % 30 === 0 && this.insideDrift(b.p, 4)) this.spawnFrond(b, cam, rng, false)
      const w = this.ctx.services.world?.currentAt(b.p) ?? current
      b.v.set(w.x * 0.55 + Math.sin(t * 0.13 + i) * 0.12, Math.sin(t * 0.21 + i * 1.7) * 0.06, w.z * 0.55 + Math.cos(t * 0.11 + i) * 0.12)
      b.p.addScaledVector(b.v, dt)
      b.rot.x += b.spin.x * dt
      b.rot.y += b.spin.y * dt
      b.rot.z += b.spin.z * dt
      _q.setFromEuler(b.rot)
      _m.compose(b.p, _q, _s.setScalar(b.scale))
      this.fronds.setMatrixAt(i, _m)
    }
    this.fronds.instanceMatrix.needsUpdate = true
    const rCount = this.rafts.count
    for (let i = 0; i < rCount; i++) {
      const b = this.rb[i]!
      const dx = b.p.x - cam.x
      const dz = b.p.z - cam.z
      if (dx * dx + dz * dz > 230 * 230 || b.p.y < -1e3) this.spawnRaft(b, cam, rng, b.p.y < -1e3)
      b.p.x += (current.x * 0.4 + Math.sin(t * 0.05 + i) * 0.05) * dt
      b.p.z += (current.z * 0.4 + Math.cos(t * 0.04 + i) * 0.05) * dt
      b.rot.y += b.spin.y * 0.15 * dt
      _q.setFromEuler(b.rot)
      _p.set(b.p.x, b.p.y + Math.sin(t * 0.4 + i) * 0.08, b.p.z)
      _m.compose(_p, _q, _s.set(b.scale * 1.6, b.scale, b.scale * 1.6))
      this.rafts.setMatrixAt(i, _m)
    }
    this.rafts.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.fronds.geometry.dispose()
    this.rafts.geometry.dispose()
    this.fronds.dispose()
    this.rafts.dispose()
    this.group.removeFromParent()
  }
}
