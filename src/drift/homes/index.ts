import * as THREE from 'three'
import type { HomeInfo, Vec3 } from '../../core/types'
import { HOMES } from '../../core/tuning'
import { seededRng } from '../../core/rng'
import { GeoBuilder } from '../builder'
import type { Mats } from '../materials'
import { PAL } from '../palette'
import { figureMaterial, instanceLooks, lookFor, rigGeometry, ROLE_FEATS, RIG, touchLooks, writeLook, writePose, type Look, type Role } from '../people'
import { HOLE_UNIFORMS } from './holes'
import { buildInterior, SEA_UNIFORMS, type Interior } from './interior'
import { framePoint, type ClosedDoor, type HomeDef } from './plan'

interface DoorRt { def: HomeDef; hinge: THREE.Vector3; base: number; swing: number; t: number; look: Look }

const UP = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3(1, 1, 1)
const _e = new THREE.Euler()
const _sc = new THREE.Vector3()

function leafGeometry(): THREE.BufferGeometry {
  const b = new GeoBuilder()
  b.jitter = 0
  const w = HOMES.doorW
  const h = HOMES.doorH
  b.box(w / 2, h / 2, 0, w - 0.04, h - 0.04, 0.06, PAL.teal)
  for (const y of [0.5, h - 0.5]) b.box(w / 2, y, 0.035, w - 0.2, 0.08, 0.02, PAL.laiton)
  b.sphere(w - 0.15, h * 0.48, 0.06, 0.05, 0.05, 0.05, PAL.laiton)
  b.sphere(w / 2, h * 0.75, 0.035, 0.16, 0.16, 0.02, PAL.lampe)
  return b.build()
}

export class Homes {
  readonly group = new THREE.Group()
  private readonly doors: DoorRt[]
  private readonly byId = new Map<string, HomeDef>()
  private readonly notes = new Map<string, string>()
  private readonly built = new Map<string, Interior>()
  private readonly leaves: THREE.InstancedMesh
  private readonly residents = new Map<Role, THREE.InstancedMesh>()
  private time = 0
  private scan = 0

  constructor(mats: Mats, private readonly root: THREE.Object3D, defs: readonly HomeDef[], closed: readonly ClosedDoor[], private readonly glow: THREE.Material, private readonly emissive: THREE.Material) {
    this.group.name = 'maisons'
    root.add(this.group)
    for (const d of defs) this.byId.set(d.id, d)
    for (const c of closed) if (c.note) this.notes.set(c.id, c.note)
    this.doors = defs.map((def) => {
      const f = def.frame
      const hinge = framePoint(f, def.room.du - HOMES.doorW / 2, def.room.floor, def.doorD + 0.06)
      const base = f.along ? 0 : -Math.PI / 2
      const open = (a: number) => new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, base + a)
      const swing = open(1.6).x * -f.inX + open(1.6).z * -f.inZ > 0 ? 1.6 : -1.6
      return { def, hinge, base, swing, t: 0, look: lookFor(def.role, seededRng(def.id)) }
    })
    this.leaves = new THREE.InstancedMesh(leafGeometry(), mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, rim: 0.4 }), Math.max(1, defs.length))
    this.leaves.name = 'portes-maisons'
    this.leaves.frustumCulled = false
    this.leaves.count = defs.length
    this.doors.forEach((d, i) => this.poseLeaf(d, i))
    this.group.add(this.leaves)
    const figMat = figureMaterial(mats, true)
    for (const role of new Set(defs.map((d) => d.role))) {
      const geo = rigGeometry(ROLE_FEATS[role], 'lo')
      instanceLooks(geo, HOMES.maxBuilt, true)
      const im = new THREE.InstancedMesh(geo, figMat, HOMES.maxBuilt)
      im.name = `habitants-maisons:${role}`
      im.frustumCulled = false
      im.count = 0
      this.residents.set(role, im)
      this.group.add(im)
    }
  }

  get count(): number {
    return this.doors.length
  }

  info(id: string): HomeInfo | null {
    const h = this.byId.get(id)
    if (h) return { id, nom: h.nom, owner: h.owner, lines: h.lines, note: null, request: h.request }
    const note = this.notes.get(id)
    return note ? { id, nom: '', owner: null, lines: [], note, request: null } : null
  }

  builtIds(): string[] {
    return [...this.built.keys()]
  }

  update(dt: number, hero: Vec3, dayLight: number): void {
    this.time += dt
    SEA_UNIFORMS.uTime.value = this.time
    SEA_UNIFORMS.uDay.value = dayLight
    this.scan -= dt
    if (this.scan <= 0) {
      this.scan = 0.4
      this.stream(hero)
    }
    let dirty = false
    this.doors.forEach((d, i) => {
      const goal = this.near(d, hero) ? 1 : 0
      if (d.t === goal) return
      d.t = goal > d.t ? Math.min(1, d.t + dt * HOMES.doorSpeed) : Math.max(0, d.t - dt * HOMES.doorSpeed)
      this.poseLeaf(d, i)
      dirty = true
    })
    if (dirty) this.leaves.instanceMatrix.needsUpdate = true
    this.poseResidents()
    HOLE_UNIFORMS.uHoleInv.value.copy(this.root.matrixWorld).invert()
  }

  private near(d: DoorRt, hero: Vec3): boolean {
    return Math.abs(hero.x - d.hinge.x - (d.def.frame.along ? HOMES.doorW / 2 : 0)) < HOMES.doorReach
      && Math.abs(hero.z - d.hinge.z - (d.def.frame.along ? 0 : HOMES.doorW / 2)) < HOMES.doorReach
      && Math.abs(hero.y - d.def.room.floor) < 1.5
  }

  private stream(hero: Vec3): void {
    const dist = (d: DoorRt) => Math.hypot(hero.x - d.hinge.x, (hero.y - d.hinge.y) * 2, hero.z - d.hinge.z)
    const ranked = this.doors.map((d) => ({ d, r: dist(d) })).sort((a, b) => a.r - b.r)
    const wanted = ranked.filter((x) => x.r < HOMES.buildRadius).slice(0, HOMES.maxBuilt)
    const keep = new Set(wanted.map((x) => x.d.def.id))
    const drop = ranked.filter((x) => this.built.has(x.d.def.id) && !keep.has(x.d.def.id)).reverse()
    for (const { d, r } of drop) {
      const missing = wanted.filter((x) => !this.built.has(x.d.def.id)).length
      if (r < HOMES.disposeRadius && this.built.size + missing <= HOMES.maxBuilt) continue
      this.built.get(d.def.id)!.dispose()
      this.built.delete(d.def.id)
    }
    for (const { d } of wanted) {
      if (this.built.has(d.def.id) || this.built.size >= HOMES.maxBuilt) continue
      const it = buildInterior(d.def, this.glow, this.emissive)
      this.group.add(it.group)
      this.built.set(d.def.id, it)
    }
    this.writeHoles()
  }

  private writeHoles(): void {
    let n = 0
    for (const id of this.built.keys()) {
      if (n >= HOMES.holes) break
      const h = this.byId.get(id)!
      const f = h.frame
      const c = framePoint(f, h.room.du, h.room.floor, h.doorD)
      HOLE_UNIFORMS.uHoleC.value[n]!.set(c.x, c.y, c.z, 0)
      HOLE_UNIFORMS.uHoleA.value[n]!.set(f.along ? 1 : 0, f.along ? 0 : 1, f.inX, f.inZ)
      n++
    }
    HOLE_UNIFORMS.uHoleCount.value = n
  }

  private poseLeaf(d: DoorRt, i: number): void {
    const swing = THREE.MathUtils.smoothstep(d.t, 0, 1)
    _q.setFromAxisAngle(UP, d.base + d.swing * swing)
    this.leaves.setMatrixAt(i, _m.compose(d.hinge, _q, _s))
  }

  private poseResidents(): void {
    const slots = new Map<Role, number>()
    for (const id of this.built.keys()) {
      const d = this.doors.find((q) => q.def.id === id)!
      if (!d.def.owner) continue
      const im = this.residents.get(d.def.role)!
      const slot = slots.get(d.def.role) ?? 0
      slots.set(d.def.role, slot + 1)
      const o = d.def.layout.owner
      const p = framePoint(d.def.frame, o.u, d.def.room.floor, o.d, _v)
      const sit = o.pose === 'sit'
      if (sit) p.y += 0.45 - RIG.hip * d.look.height
      const yaw = -Math.atan2(d.def.frame.inX, -d.def.frame.inZ) + (o.faceDoor ? 0 : Math.PI)
      const lean = o.pose === 'work' ? 0.3 + Math.sin(this.time * 1.8) * 0.05 : Math.sin(this.time * 0.7 + slot) * 0.03
      _e.set(-lean, yaw, 0, 'YXZ')
      _q.setFromEuler(_e)
      im.setMatrixAt(slot, _m.compose(p, _q, _sc.setScalar(d.look.height)))
      writeLook(im.geometry, slot, d.look)
      writePose(im.geometry, slot, 1, slot, 0, sit ? 1.45 : 0)
    }
    for (const [role, im] of this.residents) {
      im.count = slots.get(role) ?? 0
      im.visible = im.count > 0
      im.instanceMatrix.needsUpdate = true
      touchLooks(im.geometry)
      ;(im.geometry.getAttribute('iPose') as THREE.InstancedBufferAttribute).needsUpdate = true
    }
  }

  dispose(): void {
    for (const it of this.built.values()) it.dispose()
    this.built.clear()
    this.leaves.geometry.dispose()
    this.leaves.dispose()
    for (const im of this.residents.values()) im.geometry.dispose()
    this.group.removeFromParent()
  }
}
