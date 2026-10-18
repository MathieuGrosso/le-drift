import * as THREE from 'three'
import { DECKS, DISTRICT_BY_ID, DRIFT_BOUNDS, TETHER } from '../core/layout'
import type { ColliderKind, DistrictId, GameContext, LockId, Vec3 } from '../core/types'
import { makeMaterial } from './surface'

export interface SortieRing { id: string; local: Vec3; normal: Vec3; level: number; s: number }
export interface SwimLimits { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

const W = DRIFT_BOUNDS.x1 - DRIFT_BOUNDS.x0
const D = DRIFT_BOUNDS.z1 - DRIFT_BOUNDS.z0
const PERIMETER = 2 * (W + D)
const LEVELS = [DECKS.principal.y + 1.5, DECKS.haut.y + 1.5, DECKS.toits.y + 1.5]
const PROBE_OUT = 18
const PROBE_REACH = 60
const ROPE_SEG = 12
const ROPE_SIDES = 5
const MISS: ColliderKind[] = ['trigger', 'fauna', 'terrain', 'rock', 'kelp', 'coral']

export const SWIM_LIMITS: SwimLimits = {
  x0: DRIFT_BOUNDS.x0 - 45, x1: DRIFT_BOUNDS.x1 + 45,
  y0: DRIFT_BOUNDS.y0 - 9, y1: DRIFT_BOUNDS.y1 + 14,
  z0: DRIFT_BOUNDS.z0 - 45, z1: DRIFT_BOUNDS.z1 + 45,
}

// Perimeter parameter s starts at the middle of the aft face (the lock side) and runs clockwise seen from above.
function perimeterPoint(s: number): { x: number; z: number; nx: number; nz: number } {
  let t = ((s % PERIMETER) + PERIMETER) % PERIMETER
  const hx = W / 2
  const hz = D / 2
  if (t < hx) return { x: t, z: hz, nx: 0, nz: 1 }
  t -= hx
  if (t < D) return { x: hx, z: hz - t, nx: 1, nz: 0 }
  t -= D
  if (t < W) return { x: hx - t, z: -hz, nx: 0, nz: -1 }
  t -= W
  if (t < D) return { x: -hx, z: -hz + t, nx: -1, nz: 0 }
  t -= D
  return { x: -hx + t, z: hz, nx: 0, nz: 1 }
}

function perimeterParam(x: number, z: number): number {
  const hx = W / 2
  const hz = D / 2
  const dx = hx - Math.abs(x)
  const dz = hz - Math.abs(z)
  if (dz <= dx) return z > 0 ? (x >= 0 ? x : PERIMETER + x) : hx + D + (hx - x)
  return x > 0 ? hx + (hz - z) : hx + D + W + (z + hz)
}

const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % PERIMETER
  return Math.min(d, PERIMETER - d)
}

interface Slot { id: string; level: number; s: number; ring: SortieRing | null; probed: boolean }

export class SortieSpace {
  readonly group = new THREE.Group()
  private readonly slots: Slot[] = []
  private readonly rings: InstancedRings
  private ropeMesh: THREE.Mesh | null = null
  private readonly ropeMaterial: THREE.Material
  private probeTimer = 0
  private dirty = true
  private readonly lockRings = new Map<LockId, SortieRing>()

  constructor(private readonly ctx: GameContext) {
    this.group.name = 'world-sortie'
    const per = Math.round(PERIMETER / TETHER.ringSpacing)
    LEVELS.forEach((y, level) => {
      for (let i = 0; i < per; i++) {
        const s = (i + (level % 2) * 0.5) * (PERIMETER / per)
        this.slots.push({ id: `anneau-${level}-${i}`, level, s, ring: null, probed: false })
      }
    })
    this.rings = new InstancedRings(ctx, this.slots.length + 12)
    this.group.add(this.rings.group)
    this.ropeMaterial = makeMaterial(ctx, { color: 0xc9b089, onShader: ropeSway })
  }

  allRings(): readonly SortieRing[] {
    const out: SortieRing[] = []
    for (const s of this.slots) if (s.ring) out.push(s.ring)
    return out
  }

  update(dt: number, sortie: boolean): void {
    const d = this.ctx.state.drift
    this.group.position.set(d.position.x, d.position.y, d.position.z)
    this.group.rotation.set(0, -d.heading, 0)
    this.probeTimer -= dt
    if (this.probeTimer <= 0) {
      const pending = this.slots.some((s) => !s.ring)
      if (pending || !this.slots.some((s) => s.probed)) this.probe(!sortie)
      this.probeTimer = sortie ? 2.5 : 12
    }
    if (this.dirty) this.rebuild()
    this.rings.update(this.ctx.clock.elapsed)
  }

  invalidate(): void {
    for (const s of this.slots) s.probed = false
    this.probeTimer = 0
  }

  private probe(quick: boolean): void {
    const phys = this.ctx.physics
    let budget = quick ? 24 : this.slots.length
    for (const slot of this.slots) {
      if (slot.ring && slot.probed) continue
      if (budget-- <= 0) break
      slot.probed = true
      const p = perimeterPoint(slot.s)
      const y = LEVELS[slot.level]!
      const origin = this.toWorld({ x: p.x + p.nx * PROBE_OUT, y, z: p.z + p.nz * PROBE_OUT })
      const dir = this.dirToWorld({ x: -p.nx, y: 0, z: -p.nz })
      const hit = phys.raycast(origin, dir, PROBE_REACH, { excludeKinds: MISS })
      if (!hit || hit.distance < 0.5 || hit.distance > PROBE_OUT + 14) continue
      const n = this.dirToLocal(hit.normal)
      if (Math.abs(n.y) > 0.85) continue
      const local = this.toLocal(hit.point)
      const prev = slot.ring
      slot.ring = {
        id: slot.id, level: slot.level, s: slot.s,
        local: { x: local.x + n.x * 0.2, y: local.y + n.y * 0.2, z: local.z + n.z * 0.2 },
        normal: n,
      }
      if (!prev || Math.hypot(prev.local.x - slot.ring.local.x, prev.local.y - slot.ring.local.y, prev.local.z - slot.ring.local.z) > 0.05) this.dirty = true
    }
  }

  lockRing(lockId: LockId): SortieRing {
    const cached = this.lockRings.get(lockId)
    if (cached) return cached
    const drift = this.ctx.services.drift
    const anchorW = drift?.lockAnchor(lockId) ?? (lockId === 'sas' ? drift?.lockPosition() ?? null : null)
    let ring: SortieRing
    if (anchorW) {
      const l = this.toLocal(anchorW)
      const s = perimeterParam(l.x, l.z)
      const p = perimeterPoint(s)
      ring = { id: `anneau-${lockId}`, local: l, normal: { x: p.nx, y: 0, z: p.nz }, level: -1, s }
    } else {
      const district = lockDistrict(lockId)
      const def = DISTRICT_BY_ID[district]
      const cx = (def.x0 + def.x1) / 2
      const cz = (def.z0 + def.z1) / 2
      const ex = Math.abs(cx) / (W / 2)
      const ez = Math.abs(cz) / (D / 2)
      const x = ex > ez ? Math.sign(cx) * (W / 2 - 3) : cx
      const z = ex > ez ? cz : Math.sign(cz || 1) * (D / 2 - 3)
      const s = perimeterParam(x, z)
      const p = perimeterPoint(s)
      const y = lockId === 'dome-proue' ? DECKS.domes.y + 6 : DECKS.principal.y + 1.2
      ring = { id: `anneau-${lockId}`, local: { x, y, z }, normal: { x: p.nx, y: 0, z: p.nz }, level: -1, s }
    }
    this.lockRings.set(lockId, ring)
    this.dirty = true
    return ring
  }

  bounds(lockId: LockId): { ringsLocal: Vec3[]; ringIds: string[]; tetherMax: number } {
    const lock = this.lockRing(lockId)
    const rings = this.allRings()
      .map((r) => ({ r, d: wrapDist(r.s, lock.s) + Math.abs(r.local.y - lock.local.y) * 1.5 }))
      .sort((a, b) => a.d - b.d)
      .map((e) => e.r)
    return {
      ringsLocal: [lock.local, ...rings.map((r) => ({ ...r.local }))],
      ringIds: [lock.id, ...rings.map((r) => r.id)],
      tetherMax: TETHER.length,
    }
  }

  nearest(local: Vec3, maxDist: number): SortieRing | null {
    let best: SortieRing | null = null
    let bd = maxDist
    const all = [...this.allRings(), ...this.lockRings.values()]
    for (const r of all) {
      const d = Math.hypot(r.local.x - local.x, r.local.y - local.y, r.local.z - local.z)
      if (d < bd) {
        bd = d
        best = r
      }
    }
    return best
  }

  private rebuild(): void {
    this.dirty = false
    const rings = this.allRings()
    this.rings.set([...rings, ...this.lockRings.values()])
    this.ropeMesh?.geometry.dispose()
    this.ropeMesh?.removeFromParent()
    this.ropeMesh = null
    const byLevel = new Map<number, SortieRing[]>()
    for (const r of rings) {
      const list = byLevel.get(r.level) ?? []
      list.push(r)
      byLevel.set(r.level, list)
    }
    const pairs: [SortieRing, SortieRing][] = []
    for (const list of byLevel.values()) {
      list.sort((a, b) => a.s - b.s)
      for (let i = 0; i < list.length; i++) {
        const a = list[i]!
        const b = list[(i + 1) % list.length]!
        if (a === b) continue
        const d = Math.hypot(a.local.x - b.local.x, a.local.y - b.local.y, a.local.z - b.local.z)
        if (d < TETHER.ringSpacing * 1.45 && wrapDist(a.s, b.s) < TETHER.ringSpacing * 1.6) pairs.push([a, b])
      }
    }
    for (const lock of this.lockRings.values()) {
      const near = rings
        .filter((r) => r.level === 0)
        .map((r) => ({ r, d: Math.hypot(r.local.x - lock.local.x, r.local.y - lock.local.y, r.local.z - lock.local.z) }))
        .filter((e) => e.d < TETHER.ringSpacing * 1.2)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
      for (const e of near) pairs.push([lock, e.r])
    }
    if (pairs.length === 0) return
    const geo = ropeGeometry(pairs)
    this.ropeMesh = new THREE.Mesh(geo, this.ropeMaterial)
    this.ropeMesh.name = 'world-lignes-de-vie'
    this.group.add(this.ropeMesh)
  }

  private toWorld(p: Vec3): Vec3 {
    const d = this.ctx.state.drift
    const c = Math.cos(d.heading)
    const s = Math.sin(d.heading)
    return { x: p.x * c - p.z * s + d.position.x, y: p.y + d.position.y, z: p.x * s + p.z * c + d.position.z }
  }

  private toLocal(p: Vec3): Vec3 {
    const d = this.ctx.state.drift
    const c = Math.cos(d.heading)
    const s = Math.sin(d.heading)
    const dx = p.x - d.position.x
    const dz = p.z - d.position.z
    return { x: dx * c + dz * s, y: p.y - d.position.y, z: -dx * s + dz * c }
  }

  private dirToWorld(v: Vec3): Vec3 {
    const h = this.ctx.state.drift.heading
    const c = Math.cos(h)
    const s = Math.sin(h)
    return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c }
  }

  private dirToLocal(v: Vec3): Vec3 {
    const h = this.ctx.state.drift.heading
    const c = Math.cos(h)
    const s = Math.sin(h)
    return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }
  }

  dispose(): void {
    this.ropeMesh?.geometry.dispose()
    this.ropeMaterial.dispose()
    this.rings.dispose()
    this.group.removeFromParent()
  }
}

function lockDistrict(lockId: LockId): DistrictId {
  if (lockId === 'sas' || lockId === 'echelle-toit') return 'ecluse'
  if (lockId === 'dome-proue') return 'proue'
  return lockId.slice(4) as DistrictId
}

export function clampSwimLocal(p: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  out.x = Math.min(SWIM_LIMITS.x1, Math.max(SWIM_LIMITS.x0, p.x))
  out.y = Math.min(SWIM_LIMITS.y1, Math.max(SWIM_LIMITS.y0, p.y))
  out.z = Math.min(SWIM_LIMITS.z1, Math.max(SWIM_LIMITS.z0, p.z))
  return out
}

function ropeSway(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = 'attribute float aSag;\nuniform float rdTime;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    float wdPhase = rdTime * 0.9 + position.x * 0.21 + position.z * 0.17;
    transformed += vec3(sin(wdPhase) * 0.1, sin(wdPhase * 0.7 + 1.3) * 0.16, cos(wdPhase * 0.8) * 0.1) * aSag;`,
  )
}

function ropeGeometry(pairs: [SortieRing, SortieRing][]): THREE.BufferGeometry {
  const vertsPerRope = (ROPE_SEG + 1) * ROPE_SIDES
  const pos = new Float32Array(pairs.length * vertsPerRope * 3)
  const nor = new Float32Array(pairs.length * vertsPerRope * 3)
  const sag = new Float32Array(pairs.length * vertsPerRope)
  const index: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  const t = new THREE.Vector3()
  const u = new THREE.Vector3()
  const v = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let vi = 0
  pairs.forEach(([ra, rb], ri) => {
    a.set(ra.local.x + ra.normal.x * 0.22, ra.local.y, ra.local.z + ra.normal.z * 0.22)
    b.set(rb.local.x + rb.normal.x * 0.22, rb.local.y, rb.local.z + rb.normal.z * 0.22)
    const len = a.distanceTo(b)
    const drop = 0.4 + len * 0.035
    const at = (k: number, out: THREE.Vector3) => out.lerpVectors(a, b, k).addScaledVector(up, -drop * 4 * k * (1 - k))
    for (let i = 0; i <= ROPE_SEG; i++) {
      const k = i / ROPE_SEG
      at(k, p)
      at(Math.min(1, k + 0.01), q)
      at(Math.max(0, k - 0.01), t)
      t.subVectors(q, t).normalize()
      u.crossVectors(t, up)
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0)
      u.normalize()
      v.crossVectors(u, t).normalize()
      for (let j = 0; j < ROPE_SIDES; j++) {
        const ang = (j / ROPE_SIDES) * Math.PI * 2
        const cx = Math.cos(ang)
        const cy = Math.sin(ang)
        const nx = u.x * cx + v.x * cy
        const ny = u.y * cx + v.y * cy
        const nz = u.z * cx + v.z * cy
        pos[vi * 3] = p.x + nx * 0.035
        pos[vi * 3 + 1] = p.y + ny * 0.035
        pos[vi * 3 + 2] = p.z + nz * 0.035
        nor[vi * 3] = nx
        nor[vi * 3 + 1] = ny
        nor[vi * 3 + 2] = nz
        sag[vi] = Math.sin(Math.PI * k)
        vi++
      }
    }
    const base = ri * vertsPerRope
    for (let i = 0; i < ROPE_SEG; i++) {
      for (let j = 0; j < ROPE_SIDES; j++) {
        const j1 = (j + 1) % ROPE_SIDES
        const i0 = base + i * ROPE_SIDES
        const i1 = i0 + ROPE_SIDES
        index.push(i0 + j, i1 + j, i0 + j1, i0 + j1, i1 + j, i1 + j1)
      }
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setAttribute('aSag', new THREE.BufferAttribute(sag, 1))
  geo.setIndex(index)
  geo.computeBoundingSphere()
  return geo
}

class InstancedRings {
  readonly group = new THREE.Group()
  private readonly torus: THREE.InstancedMesh
  private readonly plate: THREE.InstancedMesh
  private readonly lamp: THREE.InstancedMesh
  private readonly materials: THREE.Material[]
  private readonly lampMat: THREE.Material

  constructor(ctx: GameContext, capacity: number) {
    const brass = makeMaterial(ctx, { color: 0xd9b48f })
    const iron = makeMaterial(ctx, { color: 0x4f6d7a })
    this.lampMat = makeMaterial(ctx, { color: 0xffe2a8, emissive: 0xffb860 })
    this.materials = [brass, iron, this.lampMat]
    const torusGeo = new THREE.TorusGeometry(0.2, 0.04, 6, 14).rotateY(Math.PI / 2).translate(0, 0, 0.2)
    const plateGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03)
    const lampGeo = new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.32, 0.08)
    this.torus = new THREE.InstancedMesh(torusGeo, brass, capacity)
    this.plate = new THREE.InstancedMesh(plateGeo, iron, capacity)
    this.lamp = new THREE.InstancedMesh(lampGeo, this.lampMat, capacity)
    for (const m of [this.torus, this.plate, this.lamp]) {
      m.count = 0
      m.frustumCulled = false
      this.group.add(m)
    }
    this.torus.name = 'world-anneaux'
  }

  set(rings: SortieRing[]): void {
    const m = new THREE.Matrix4()
    const x = new THREE.Vector3()
    const y = new THREE.Vector3()
    const z = new THREE.Vector3()
    const n = Math.min(rings.length, this.torus.instanceMatrix.count)
    for (let i = 0; i < n; i++) {
      const r = rings[i]!
      z.set(r.normal.x, 0, r.normal.z)
      if (z.lengthSq() < 1e-4) z.set(0, 0, 1)
      z.normalize()
      y.set(0, 1, 0)
      x.crossVectors(y, z).normalize()
      const k = r.level < 0 ? 1.8 : 1
      m.makeBasis(x.multiplyScalar(k), y.multiplyScalar(k), z.multiplyScalar(k)).setPosition(r.local.x, r.local.y, r.local.z)
      this.torus.setMatrixAt(i, m)
      this.plate.setMatrixAt(i, m)
      this.lamp.setMatrixAt(i, m)
    }
    for (const mesh of [this.torus, this.plate, this.lamp]) {
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  update(elapsed: number): void {
    const u = (this.lampMat.userData.celUniforms as { rdCelEmissive?: { value: THREE.Color } } | undefined)?.rdCelEmissive
    if (u) u.value.setHex(0xffb860).multiplyScalar(0.75 + 0.25 * Math.sin(elapsed * 1.7))
  }

  dispose(): void {
    for (const m of [this.torus, this.plate, this.lamp]) {
      m.geometry.dispose()
      m.dispose()
    }
    for (const mat of this.materials) mat.dispose()
  }
}
