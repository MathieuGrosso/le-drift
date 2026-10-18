import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DistrictId, GameContext, Vec3 } from '../../core/types'
import { GeoBuilder } from '../builder'
import type { Mats } from '../materials'
import { NOISE_GLSL } from '../materials'
import { PAL } from '../palette'
import { Crowd } from './crowd'
import { Folk } from './folk'
import { bakeGlow, CITY_UNIFORMS, glowMaterial, LampGrid, lightAt, skyAt, type BakeLamp, type SkyBake } from './glow'
import type { Anchor, CellDef, DoorSpec, Kit, LadderSpec, LockRule, PlaceSpec, RideSpec, ScelleeSpec, SeatSpec, SignSpec, WaterSpec } from './kit'
import { buildCity, type CityBuild } from './world'

export type { Anchor, CellDef, PlaceSpec, ScelleeSpec } from './kit'

export interface CitySites {
  domes: { id: string; district: DistrictId; local: Vec3; top: Vec3; lunette: Vec3 }[]
  scellees: (ScelleeSpec & { cell: string })[]
  trouvailles: { id: string; local: Vec3; district: DistrictId }[]
  places: PlaceSpec[]
}

type GroupKey = DistrictId | 'liens'
interface DistrictRt {
  id: GroupKey
  group: THREE.Group
  body: RAPIER.RigidBody
  loaded: boolean
  snap: boolean
}

interface DoorRt {
  spec: DoorSpec
  district: GroupKey
  pivot: THREE.Group
  t: number
  open: boolean
  collider: RAPIER.Collider | null
}

interface LiveLamp { local: THREE.Vector3; world: THREE.Vector3; color: THREE.Color; radius: number; district: GroupKey }

type HeroTube = { tube?(toLocal: Vec3, yaw: number): Promise<void> }
type LooseBus = { emit(k: string, p: unknown): void; on(k: string, fn: (p: never) => void): () => void }

const BASE: Record<DistrictId, number> = {
  nef: 0x8a7258, marche: 0x8a6a52, serres: 0x6f7c56, ateliers: 0x6f6a62, scellees: 0x4e5a60,
  machines: 0x7a5440, proue: 0x857868, ecluse: 0x857262, hauts: 0x6f8080,
}

const GLASS_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vC = color;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const GLASS_FRAG = /* glsl */ `
uniform float uDay;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(V, normalize(vN))), 2.2);
  float streak = smoothstep(0.93, 1.0, sin((vW.x + vW.y * 0.7 + vW.z * 0.4) * 0.45)) * 0.35;
  vec3 c = mix(vC, vec3(1.0), f * 0.55 + streak);
  gl_FragColor = vec4(c * (0.75 + 0.25 * uDay), 0.06 + f * 0.42 + streak * 0.25);
}`

const WATER_VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const WATER_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vW;
${NOISE_GLSL}
void main() {
  float n = dFbm(vW.xz * 0.6 + vec2(uTime * 0.12, -uTime * 0.09));
  float glint = smoothstep(0.62, 0.75, dFbm(vW.xz * 2.2 - vec2(uTime * 0.2, uTime * 0.15)));
  vec3 c = mix(vec3(0.16, 0.42, 0.46), vec3(0.42, 0.72, 0.7), n) + glint * 0.35;
  gl_FragColor = vec4(c, 0.72);
}`

const SHAFT_VERT = /* glsl */ `
varying float vH;
varying vec3 vW;
varying vec3 vN;
void main() {
  vH = position.y + 0.5;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SHAFT_FRAG = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uTint;
varying float vH;
varying vec3 vW;
varying vec3 vN;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float edge = pow(abs(dot(V, normalize(vN))), 1.6);
  float flick = 0.8 + 0.2 * sin(uTime * 0.7 + vW.x * 0.3 + vW.z * 0.2);
  float a = edge * smoothstep(0.0, 0.6, vH) * (0.35 + 0.65 * vH) * uStrength * flick;
  gl_FragColor = vec4(uTint * a, a);
}`

const KELP_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vY;
varying float vSeed;
void main() {
  vY = uv.y;
  vSeed = aSeed;
  vec3 p = position;
  float k = uv.y * uv.y;
  p.x += sin(uTime * 0.9 + aSeed * 30.0 + uv.y * 2.4) * 0.35 * k;
  p.z += cos(uTime * 0.7 + aSeed * 17.0 + uv.y * 1.8) * 0.2 * k;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
}`
const KELP_FRAG = /* glsl */ `
uniform float uLight;
varying float vY;
varying float vSeed;
void main() {
  vec3 lo = vec3(0.24, 0.36, 0.2);
  vec3 hi = mix(vec3(0.78, 0.68, 0.3), vec3(0.62, 0.8, 0.42), fract(vSeed * 7.0));
  vec3 c = mix(lo, hi, smoothstep(0.0, 1.0, vY));
  c *= 0.85 + 0.25 * step(0.5, fract(vY * 6.0 + vSeed * 3.0));
  gl_FragColor = vec4(c * uLight, 1.0);
}`

const MOTE_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vA;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.21 + aSeed * 40.0) * 0.8;
  p.x += sin(uTime * 0.13 + aSeed * 19.0) * 0.9;
  p.z += cos(uTime * 0.17 + aSeed * 23.0) * 0.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 60.0);
  gl_PointSize = clamp(60.0 / max(-mv.z, 0.5), 1.0, 7.0);
  gl_Position = projectionMatrix * mv;
}`
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.55;
  gl_FragColor = vec4(uColor * a, a);
}`

const STEAM_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vA;
void main() {
  float t = fract(uTime * 0.16 + aSeed);
  vec3 p = position + vec3(sin(aSeed * 40.0 + uTime) * 0.4 * t, t * 4.5, cos(aSeed * 23.0 + uTime * 0.7) * 0.4 * t);
  vA = smoothstep(0.0, 0.15, t) * (1.0 - t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (160.0 + 380.0 * t) / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}`
const STEAM_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.3;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.9), a);
}`

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const UP = new THREE.Vector3(0, 1, 0)

export class City {
  readonly group = new THREE.Group()
  readonly cells: CellDef[]
  readonly build: CityBuild
  private readonly districts = new Map<GroupKey, DistrictRt>()
  private readonly portals: Kit['portals'] = []
  private readonly ladders: LadderSpec[] = []
  private readonly anchors: Anchor[] = []
  private readonly seats = new Map<string, SeatSpec>()
  private readonly doors = new Map<string, DoorRt>()
  private readonly rides = new Map<string, RideSpec>()
  private readonly lamps: LiveLamp[] = []
  private readonly mats: THREE.ShaderMaterial[] = []
  private readonly shaftMats: THREE.ShaderMaterial[] = []
  private readonly kelpMats: THREE.ShaderMaterial[] = []
  private readonly glassMats: THREE.ShaderMaterial[] = []
  private readonly pistons: { im: THREE.InstancedMesh; list: Kit['pistons'] }[] = []
  private readonly trouvailles: { id: string; local: Vec3; district: DistrictId; im: THREE.InstancedMesh; index: number }[] = []
  private readonly lanterns: { im: THREE.InstancedMesh; ids: string[] } | null
  private readonly crowd: Crowd
  readonly folk: Folk
  private readonly pools = new Map<string, { mesh: THREE.Mesh; spec: ScelleeSpec; level: number; target: number }>()
  private readonly glassCells = new Set<string>()
  private readonly offs: (() => void)[] = []
  private riding = 0
  private time = 0
  private slow = 0
  private visible: ReadonlySet<DistrictId> | null = null
  readonly insideHullMat: THREE.Material

  constructor(private readonly ctx: GameContext, mats: Mats, parent: THREE.Object3D, pose: { position: Vec3; heading: number }) {
    this.group.name = 'drift-ville'
    parent.add(this.group)
    this.build = buildCity()
    const glow = glowMaterial(mats)
    const glow2 = glowMaterial(mats, { side: THREE.DoubleSide, rim: 0.2 })
    this.insideHullMat = glowMaterial(mats, { rim: 0.6 })
    const emissive = mats.water(new THREE.MeshBasicMaterial({ vertexColors: true }))
    const lineMat = new THREE.LineBasicMaterial({ color: PAL.corde, transparent: true, opacity: 0.85 })
    const R = ctx.physics.rapier
    const q = new THREE.Quaternion().setFromAxisAngle(UP, -pose.heading)
    const groups = ((ctx.physics.groups.TERRAIN & 0xffff) << 16) | 0xffff
    const quality = ctx.quality.level
    const allCells: CellDef[] = []
    const lanternIds: string[] = []
    const lanternPos: THREE.Vector3[] = []

    const groupsList: [GroupKey, Kit][] = [...this.build.kits.entries(), ['liens', this.build.links]]
    for (const [id, k] of groupsList) {
      const g = new THREE.Group()
      g.name = `ville:${id}`
      this.group.add(g)
      const bake: BakeLamp[] = k.lamps.map((l) => ({ x: l.x, y: l.y, z: l.z, color: new THREE.Color(l.color), radius: l.radius * 1.15, power: 0.55 * l.bake }))
      const base = new THREE.Color(BASE[id === 'liens' ? 'nef' : id])
      const grid = new LampGrid(bake)
      const hall = this.build.halls.find((h) => h.district === id)
      const sky: SkyBake | null = hall ? { y0: hall.floorY - 2, y1: hall.spring + hall.rise, color: new THREE.Color(0x9fd6d0), power: id === 'scellees' ? 0.18 : id === 'serres' ? 0.5 : 0.36 } : id === 'hauts' ? { y0: 20, y1: 30, color: new THREE.Color(0x9fd6d0), power: 0.5 } : null
      const add = (b: GeoBuilder, mat: THREE.Material, name: string, baked: boolean) => {
        if (b.vertexCount === 0) return
        const geo = b.build()
        if (baked) bakeGlow(geo, grid.near, base, sky)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.name = `${name}:${id}`
        mesh.matrixAutoUpdate = false
        g.add(mesh)
        return mesh
      }
      add(k.b, glow, 'structure', true)
      add(k.cloth, glow2, 'tissus', true)
      add(k.e, emissive, 'lumieres', false)
      if (k.glass.vertexCount > 0) {
        const gm = new THREE.ShaderMaterial({
          uniforms: { uDay: { value: 1 } }, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
          vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        })
        this.glassMats.push(gm)
        const mesh = add(k.glass, gm, 'verre', false)
        if (mesh) mesh.renderOrder = 3
      }
      if (k.lines.length > 0) {
        const lg = new THREE.BufferGeometry()
        lg.setAttribute('position', new THREE.Float32BufferAttribute(k.lines, 3))
        const ls = new THREE.LineSegments(lg, lineMat)
        ls.name = `cordes:${id}`
        g.add(ls)
      }
      for (const s of k.signs) g.add(signMesh(s))
      this.buildWaters(k, g)
      this.buildPools(k, g)
      this.buildShafts(k, g)
      this.buildKelp(k, g)
      this.buildPistons(k, g, mats)
      this.buildSteam(k, g)
      this.buildMotes(k, g, quality)
      this.buildTrouvailles(k, g, mats)
      for (const d of k.domes) {
        lanternIds.push(d.id)
        lanternPos.push(new THREE.Vector3(d.x, d.y + 0.45, d.z))
      }

      const body = ctx.physics.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased().setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      )
      for (const c of k.cols) {
        const desc = R.ColliderDesc.cuboid(Math.max(0.02, c.hx), Math.max(0.02, c.hy), Math.max(0.02, c.hz)).setTranslation(c.x, c.y, c.z).setCollisionGroups(groups)
        if (c.q) desc.setRotation({ x: c.q.x, y: c.q.y, z: c.q.z, w: c.q.w })
        const col = ctx.physics.world.createCollider(desc, body)
        ctx.physics.tag(col, { kind: c.kind, climbable: c.climbable, ...(c.ownerId ? { ownerId: c.ownerId } : {}) })
      }
      this.districts.set(id, { id, group: g, body, loaded: true, snap: false })
      for (const l of k.lamps) if (l.live) this.lamps.push({ local: new THREE.Vector3(l.x, l.y, l.z), world: new THREE.Vector3(), color: new THREE.Color(l.color), radius: l.radius, district: id })
      this.ladders.push(...k.ladders)
      this.anchors.push(...k.anchors)
      for (const s of k.seats) this.seats.set(s.id, s)
      for (const r of k.rides) this.rides.set(r.id, r)
      for (const d of k.doors) this.makeDoor(d, id, g, body)
      allCells.push(...k.cells)
      this.portals.push(...k.portals)
    }
    this.cells = allCells.sort((a, b) => vol(a) - vol(b))

    if (lanternIds.length > 0) {
      const geo = new THREE.SphereGeometry(0.55, 14, 10)
      const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lanternIds.length)
      lanternPos.forEach((p, i) => {
        im.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z))
        im.setColorAt(i, new THREE.Color(PAL.froid))
      })
      im.name = 'lanternes-domes'
      this.group.add(im)
      this.lanterns = { im, ids: lanternIds }
    } else this.lanterns = null

    const paths = [...this.build.kits.values()].flatMap((k) => k.paths)
    const spots = [...this.build.kits.values()].flatMap((k) => k.spots)
    this.crowd = new Crowd(mats, paths, spots, quality)
    this.group.add(this.crowd.group)
    this.folk = new Folk(mats)
    this.group.add(this.folk.group)
    for (const c of this.cells) if (c.glass) this.glassCells.add(c.id)

    const bus = ctx.bus as unknown as LooseBus
    this.offs.push(bus.on('water:level', (p: { cellId: string; level: number }) => {
      const pool = this.pools.get(p.cellId)
      if (pool) pool.target = THREE.MathUtils.clamp(p.level, 0, 1)
    }))
    this.offs.push(bus.on('door:changed', (p: { doorId: string; open: boolean }) => {
      if (this.doors.has(p.doorId)) this.setDoor(p.doorId, p.open)
    }))
    for (const d of this.doors.values()) {
      const m = /^grille-(cs-\d\d)$/.exec(d.spec.id)
      if (m && (ctx.state.flags[`cs-ouvert:${m[1]}`] || ctx.state.shallows.includes(m[1]!))) this.setDoor(d.spec.id, true, true)
    }
  }

  private buildPools(k: Kit, g: THREE.Group): void {
    if (k.scellees.length === 0) return
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false })
    this.mats.push(m)
    for (const sc of k.scellees) {
      const w = sc.water
      const geo = new THREE.PlaneGeometry(w.x1 - w.x0, w.z1 - w.z0)
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.set((w.x0 + w.x1) / 2, w.y, (w.z0 + w.z1) / 2)
      mesh.renderOrder = 2
      mesh.name = `bassin:${sc.id}`
      g.add(mesh)
      const done = this.ctx.state.shallows.includes(sc.id)
      const level = done ? 0.15 : 0.65
      this.pools.set(sc.id, { mesh, spec: sc, level, target: level })
    }
  }

  private makeDoor(d: DoorSpec, district: GroupKey, g: THREE.Group, body: RAPIER.RigidBody): void {
    const pivot = new THREE.Group()
    const b = new GeoBuilder()
    b.jitter = 0
    const w = d.w
    const h = d.h
    if (d.style === 'hatch') {
      b.box(w / 2, h / 2, 0, w, h, 0.1, PAL.teal)
      b.box(w / 2, h / 2, 0, w - 0.14, h - 0.14, 0.13, PAL.metal)
      b.box(w / 2, h - 0.08, 0, w + 0.04, 0.1, 0.16, PAL.laiton)
      b.box(w / 2, 0.08, 0, w + 0.04, 0.1, 0.16, PAL.laiton)
      for (const s of [-1, 1]) {
        b.add(new THREE.TorusGeometry(0.18, 0.03, 5, 16), new THREE.Matrix4().makeTranslation(w * 0.62, h * 0.55, s * 0.09), PAL.laiton)
        b.box(w * 0.62, h * 0.55, s * 0.09, 0.34, 0.03, 0.03, PAL.laiton)
      }
    } else {
      b.box(w / 2, 0.06, 0, w, 0.12, 0.12, PAL.metalSombre)
      b.box(w / 2, h - 0.06, 0, w, 0.12, 0.12, PAL.metalSombre)
      for (let x = 0.1; x < w; x += 0.22) b.box(x, h / 2, 0, 0.05, h, 0.05, PAL.metalSombre)
      b.box(w / 2, h * 0.5, 0, w, 0.08, 0.08, PAL.rouille)
    }
    const leaf = new THREE.Mesh(b.build(), this.insideHullMatForDoors())
    if (d.axis === 'y') {
      leaf.rotation.x = Math.PI / 2
      leaf.position.set(-w / 2, 0, 0)
      pivot.position.set(d.x, d.y + 0.02, d.z - h / 2)
    } else if (d.axis === 'z') {
      leaf.position.set(0, 0, 0)
      pivot.position.set(d.x - w / 2, d.y, d.z)
    } else {
      leaf.rotation.y = -Math.PI / 2
      pivot.position.set(d.x, d.y, d.z - w / 2)
    }
    pivot.add(leaf)
    g.add(pivot)
    const open = this.ctx.state.drift.doors[d.id] ?? d.open
    const rt: DoorRt = { spec: d, district, pivot, t: open ? 1 : 0, open, collider: null }
    this.doors.set(d.id, rt)
    this.poseDoor(rt)
    this.syncDoor(rt, body)
  }

  private doorMat: THREE.Material | null = null
  private insideHullMatForDoors(): THREE.Material {
    if (!this.doorMat) {
      const m = this.ctx.services.render?.cel({ color: 0xffffff, vertexColors: true, indoor: true, rim: 0.5, emissive: 0x1a1410 })
      this.doorMat = m ?? new THREE.MeshLambertMaterial({ vertexColors: true })
    }
    return this.doorMat
  }

  private poseDoor(d: DoorRt): void {
    const a = THREE.MathUtils.smoothstep(d.t, 0, 1) * (Math.PI * 0.55)
    if (d.spec.axis === 'y') d.pivot.rotation.set(-a * 1.6, 0, 0)
    else d.pivot.rotation.set(0, d.spec.axis === 'z' ? -a : a, 0)
  }

  private syncDoor(d: DoorRt, body?: RAPIER.RigidBody): void {
    const closed = d.t < 0.5
    const b = body ?? this.districts.get(d.district)?.body
    if (!b) return
    if (closed && !d.collider) {
      const s = d.spec
      const R = this.ctx.physics.rapier
      const groups = ((this.ctx.physics.groups.TERRAIN & 0xffff) << 16) | 0xffff
      const desc = s.axis === 'y'
        ? R.ColliderDesc.cuboid(s.w / 2, 0.08, s.h / 2).setTranslation(s.x, s.y - 0.08, s.z)
        : s.axis === 'z'
          ? R.ColliderDesc.cuboid(s.w / 2, s.h / 2, 0.08).setTranslation(s.x, s.y + s.h / 2, s.z)
          : R.ColliderDesc.cuboid(0.08, s.h / 2, s.w / 2).setTranslation(s.x, s.y + s.h / 2, s.z)
      d.collider = this.ctx.physics.world.createCollider(desc.setCollisionGroups(groups), b)
      this.ctx.physics.tag(d.collider, { kind: 'door', climbable: false, ownerId: s.id })
    } else if (!closed && d.collider) {
      this.ctx.physics.untag(d.collider)
      this.ctx.physics.world.removeCollider(d.collider, true)
      d.collider = null
    }
  }

  unlocked(rule: LockRule | undefined): boolean {
    if (!rule) return true
    const st = this.ctx.state
    if (rule.act !== undefined && st.act >= rule.act) return true
    if (rule.item && (st.inventory.items[rule.item] ?? 0) > 0) return true
    if (rule.flag && st.flags[rule.flag]) return true
    return false
  }

  hasDoor(id: string): boolean {
    return this.doors.has(id) || this.rides.has(id)
  }

  openDoor(id: string, open: boolean): boolean {
    const ride = this.rides.get(id)
    if (ride) {
      if (!this.unlocked(ride.lock)) {
        this.refuse(ride.from)
        return true
      }
      this.startRide(ride)
      return true
    }
    const d = this.doors.get(id)
    if (!d) return false
    if (open && !this.unlocked(d.spec.lock)) {
      this.refuse(d.spec)
      return true
    }
    if (d.open === open) return true
    this.setDoor(id, open)
    this.ctx.bus.emit('door:changed', { doorId: id, open })
    return true
  }

  setDoor(id: string, open: boolean, instant = false): void {
    const d = this.doors.get(id)
    if (!d || (d.open === open && !instant)) return
    d.open = open
    this.ctx.state.drift.doors[id] = open
    if (instant) {
      d.t = open ? 1 : 0
      this.poseDoor(d)
      this.syncDoor(d)
    } else this.sfx(d.spec.style === 'grate' ? 'lock-clang' : 'hatch-wheel', d.spec)
  }

  doorSpecs(): DoorSpec[] {
    return [...this.doors.values()].map((d) => d.spec)
  }

  private refuse(at: Vec3): void {
    this.sfx('hatch-clang', at)
    ;(this.ctx.bus as unknown as LooseBus).emit('door:locked', { at })
  }

  private sfx(id: string, at?: Vec3): void {
    try {
      const w = at ? this.toWorld(at) : undefined
      this.ctx.services.audio?.sfx(id, w)
    } catch {
      /* audio is optional */
    }
  }

  private toWorld(l: Vec3): Vec3 {
    _v.set(l.x, l.y, l.z).applyMatrix4(this.group.matrixWorld)
    return { x: _v.x, y: _v.y, z: _v.z }
  }

  private startRide(r: RideSpec): void {
    if (this.riding > this.time) return
    this.riding = this.time + 1.2
    const hero = this.ctx.services.hero as (NonNullable<GameContext['services']['hero']> & HeroTube) | undefined
    if (!hero) return
    const bus = this.ctx.bus as unknown as LooseBus
    if (r.kind === 'zip') {
      bus.emit('interact', { targetId: r.id, kind: 'zip' })
      return
    }
    this.sfx('tube', r.from)
    bus.emit('tube:travel', { from: r.id, to: r.to })
    if (hero.tube) void hero.tube(r.to, r.yaw)
    else hero.teleportLocal(r.to, r.yaw)
  }

  private buildWaters(k: Kit, g: THREE.Group): void {
    if (k.waters.length === 0) return
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false })
    this.mats.push(m)
    const b = new GeoBuilder()
    b.jitter = 0
    const plane = new THREE.PlaneGeometry(1, 1)
    plane.rotateX(-Math.PI / 2)
    const pools = new Set<WaterSpec>(k.scellees.map((sc) => sc.water))
    for (const w of k.waters) if (!pools.has(w)) b.add(plane, new THREE.Matrix4().compose(new THREE.Vector3((w.x0 + w.x1) / 2, w.y, (w.z0 + w.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(w.x1 - w.x0, 1, w.z1 - w.z0)), 0xffffff)
    const mesh = new THREE.Mesh(b.build(), m)
    mesh.renderOrder = 2
    mesh.name = `eau:${k.district}`
    g.add(mesh)
  }

  private buildShafts(k: Kit, g: THREE.Group): void {
    if (k.shafts.length === 0) return
    const geo = new THREE.CylinderGeometry(1, 1.6, 1, 20, 1, true)
    for (const s of k.shafts) {
      const m = new THREE.ShaderMaterial({
        uniforms: { uStrength: { value: 0.5 }, uTime: { value: 0 }, uTint: { value: new THREE.Color(s.tint) } },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      })
      this.shaftMats.push(m)
      const mesh = new THREE.Mesh(geo, m)
      const h = s.top - s.bottom
      mesh.scale.set(s.r, h, s.r)
      mesh.position.set(s.x, (s.top + s.bottom) / 2, s.z)
      mesh.rotation.z = 0.12
      mesh.rotation.x = -0.08
      mesh.renderOrder = 4
      mesh.name = 'rai'
      g.add(mesh)
    }
  }

  private buildKelp(k: Kit, g: THREE.Group): void {
    if (k.kelp.length === 0) return
    const geo = new THREE.PlaneGeometry(0.32, 1, 1, 8)
    geo.translate(0, 0.5, 0)
    const seeds = new Float32Array(k.kelp.length)
    const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uLight: { value: 1 } }, vertexShader: KELP_VERT, fragmentShader: KELP_FRAG, side: THREE.DoubleSide })
    this.kelpMats.push(m)
    const im = new THREE.InstancedMesh(geo, m, k.kelp.length)
    k.kelp.forEach((kk, i) => {
      seeds[i] = kk.seed
      _q.setFromAxisAngle(UP, kk.seed * Math.PI * 2)
      im.setMatrixAt(i, _m.compose(_v.set(kk.x, kk.y, kk.z), _q, new THREE.Vector3(1 + kk.seed, kk.h, 1)))
    })
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    im.computeBoundingSphere()
    im.name = 'laminaires-serre'
    g.add(im)
  }

  private buildPistons(k: Kit, g: THREE.Group, mats: Mats): void {
    if (k.pistons.length === 0) return
    const geo = new THREE.CylinderGeometry(1, 1, 1, 10)
    const im = new THREE.InstancedMesh(geo, mats.cel({ color: PAL.laiton, indoor: true, emissive: 0x3a2010 }), k.pistons.length)
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    im.frustumCulled = false
    g.add(im)
    this.pistons.push({ im, list: k.pistons })
  }

  private buildSteam(k: Kit, g: THREE.Group): void {
    for (const s of k.steam) {
      const n = 22
      const pos = new Float32Array(n * 3)
      const seeds = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        pos.set([s.x + (Math.random() - 0.5) * 0.5, s.y, s.z + (Math.random() - 0.5) * 0.5], i * 3)
        seeds[i] = i / n
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
      const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false })
      this.mats.push(m)
      const pts = new THREE.Points(geo, m)
      pts.frustumCulled = false
      g.add(pts)
    }
  }

  private buildMotes(k: Kit, g: THREE.Group, q: string): void {
    const hall = this.build.halls.find((h) => h.district === k.district)
    if (!hall) return
    const n = q === 'high' ? 420 : q === 'medium' ? 220 : 90
    const pos = new Float32Array(n * 3)
    const seeds = new Float32Array(n)
    let s = 7 + k.district.length
    const r = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    for (let i = 0; i < n; i++) {
      pos.set([hall.x0 + r() * (hall.x1 - hall.x0), hall.floorY + 1 + r() * (hall.spring - hall.floorY), hall.z0 + r() * (hall.z1 - hall.z0)], i * 3)
      seeds[i] = r()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(k.district === 'serres' ? 0xe8f0b0 : 0xffe2b0) } },
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    this.mats.push(m)
    const pts = new THREE.Points(geo, m)
    pts.frustumCulled = false
    pts.name = 'poussieres'
    g.add(pts)
  }

  private buildTrouvailles(k: Kit, g: THREE.Group, mats: Mats): void {
    if (k.trouvailles.length === 0) return
    const shapes = [
      new THREE.CylinderGeometry(0.05, 0.07, 0.24, 8).translate(0, 0.12, 0),
      new THREE.SphereGeometry(0.11, 10, 6).scale(1, 0.55, 1.2).translate(0, 0.06, 0),
      new THREE.BoxGeometry(0.22, 0.04, 0.07).translate(0, 0.02, 0),
      new THREE.CylinderGeometry(0.08, 0.08, 0.025, 14).translate(0, 0.0125, 0),
      new THREE.BoxGeometry(0.04, 0.02, 0.3).translate(0, 0.01, 0),
      new THREE.SphereGeometry(0.09, 10, 8).translate(0, 0.09, 0),
    ]
    const colors = [0x8fd0c0, 0xf4e1d2, PAL.laiton, 0xe3b95f, PAL.blanc, PAL.tissu1]
    shapes.forEach((geo, kind) => {
      const list = k.trouvailles.filter((t) => t.kind === kind)
      if (list.length === 0) return
      const im = new THREE.InstancedMesh(geo, mats.cel({ color: colors[kind]!, indoor: true, emissive: 0x3a3020, rim: 1.2 }), list.length)
      list.forEach((t, i) => {
        im.setMatrixAt(i, _m.makeTranslation(t.x, t.y, t.z))
        this.trouvailles.push({ id: t.id, local: { x: t.x, y: t.y, z: t.z }, district: k.district, im, index: i })
      })
      im.name = 'trouvailles'
      g.add(im)
    })
  }

  cellAt(l: Vec3): CellDef | null {
    for (const c of this.cells) {
      for (const b of c.boxes) {
        if (l.x > b.x0 && l.x < b.x1 && l.z > b.z0 && l.z < b.z1 && l.y > b.y0 && l.y < b.y1) return c
      }
    }
    return null
  }

  cellById(id: string): CellDef | null {
    return this.cells.find((c) => c.id === id) ?? null
  }

  ceilingAt(l: Vec3): number | null {
    const c = this.cellAt(l)
    return c ? c.roof : null
  }

  ladderList(cell: string): LadderSpec[] {
    const c = this.cellById(cell)
    return this.ladders.filter((l) => l.cells.includes(cell) || (c && this.cellById(l.cells[0]!)?.district === c.district))
  }

  seat(id: string): SeatSpec | null {
    return this.seats.get(id) ?? null
  }

  anchorsNear(l: Vec3, r: number): Anchor[] {
    const out: Anchor[] = []
    for (const a of this.anchors) {
      let d: number
      if (a.kind === 'ladder') d = segDist(l, a.bottom, a.top)
      else if (a.kind === 'zip') d = segDist(l, a.from, a.to)
      else if (a.kind === 'slide') d = Math.min(...a.path.map((p) => Math.hypot(p.x - l.x, p.y - l.y, p.z - l.z)))
      else d = Math.hypot(a.at.x - l.x, a.at.y - l.y, a.at.z - l.z)
      if (d <= r) out.push(a)
    }
    return out
  }

  npcLocal(id: string): THREE.Vector3 | null {
    return this.folk.position(id)
  }

  crowdNearby(l: Vec3, r: number, hours: number): { id: string; x: number; y: number; z: number; district: DistrictId; kid: boolean }[] {
    return this.crowd.nearby(l, r, hours)
  }

  visibleFrom(cell: CellDef, cam: Vec3, out: Set<DistrictId>): void {
    out.add(cell.district)
    for (const d of cell.pvs) out.add(d)
    for (const p of this.portals) {
      const own = p.cell === cell.id
      if (own || p.da === cell.district) {
        if (own || Math.hypot(p.a.x - cam.x, p.a.y - cam.y, p.a.z - cam.z) < 45) out.add(p.db)
      }
      if (own || p.db === cell.district) {
        if (own || Math.hypot(p.b.x - cam.x, p.b.y - cam.y, p.b.z - cam.z) < 45) out.add(p.da)
      }
    }
  }

  isGlass(cell: string): boolean {
    return this.glassCells.has(cell)
  }

  sites(): CitySites {
    const kits = [...this.build.kits.values()]
    return {
      domes: kits.flatMap((k) => k.domes.map((d) => ({ id: d.id as string, district: d.district, local: { x: d.lunette.x, y: d.lunette.y, z: d.lunette.z }, top: { x: d.x, y: d.y, z: d.z }, lunette: d.lunette }))),
      scellees: kits.flatMap((k) => k.scellees.map((sc) => ({ ...sc, cell: sc.id }))),
      trouvailles: this.trouvailles.map((t) => ({ id: t.id, local: t.local, district: t.district })),
      places: kits.flatMap((k) => k.places),
    }
  }

  setLoaded(loaded: ReadonlySet<DistrictId>, pose: { position: Vec3; heading: number }): void {
    for (const d of this.districts.values()) {
      const on = d.id === 'liens' || loaded.has(d.id)
      if (on === d.loaded) continue
      d.loaded = on
      for (let i = 0; i < d.body.numColliders(); i++) d.body.collider(i).setEnabled(on)
      if (on) {
        d.body.setTranslation(pose.position, true)
        d.body.setRotation(_q.setFromAxisAngle(UP, -pose.heading), true)
      }
    }
    this.crowd.setActive(loaded)
    this.folk.setActive(loaded)
  }

  setVisible(v: ReadonlySet<DistrictId> | null): void {
    this.visible = v
    for (const d of this.districts.values()) d.group.visible = v === null || d.id === 'liens' || v.has(d.id)
  }

  update(dt: number, pose: { position: Vec3; heading: number }, jumped: boolean): void {
    this.time += dt
    const st = this.ctx.state
    const q = _q.setFromAxisAngle(UP, -pose.heading)
    for (const d of this.districts.values()) {
      if (!d.loaded) continue
      if (jumped) {
        d.body.setTranslation(pose.position, true)
        d.body.setRotation(q, true)
      } else {
        d.body.setNextKinematicTranslation(pose.position)
        d.body.setNextKinematicRotation(q)
      }
    }
    const h = st.time.hours
    const day = h < 5 || h > 20.5 ? 0 : h < 7 ? (h - 5) / 2 : h > 18 ? (20.5 - h) / 2.5 : 1
    CITY_UNIFORMS.uCitySky.value = 0.15 + 0.85 * day
    CITY_UNIFORMS.uCityLamp.value = 1 + (1 - day) * 0.12
    for (const m of this.mats) m.uniforms.uTime!.value = this.time
    for (const m of this.kelpMats) {
      m.uniforms.uTime!.value = this.time
      m.uniforms.uLight!.value = 0.55 + 0.45 * day
    }
    for (const m of this.glassMats) m.uniforms.uDay!.value = day
    for (const m of this.shaftMats) {
      m.uniforms.uTime!.value = this.time
      m.uniforms.uStrength!.value = 0.32 * day * (0.6 + 0.4 * Math.min(1, st.env.visibility / 90))
    }
    for (const p of this.pistons) {
      p.list.forEach((s, i) => {
        const y = s.y + (Math.sin(this.time * 2.6 + s.phase) * 0.5 + 0.5) * s.stroke
        p.im.setMatrixAt(i, _m.compose(_v.set(s.x, y, s.z), _q.identity(), new THREE.Vector3(s.r, 0.8, s.r)))
      })
      p.im.instanceMatrix.needsUpdate = true
    }
    for (const d of this.doors.values()) {
      const target = d.open ? 1 : 0
      if (d.t === target) continue
      d.t = d.open ? Math.min(1, d.t + dt / 1.1) : Math.max(0, d.t - dt / 1.1)
      this.poseDoor(d)
      this.syncDoor(d)
      if (d.t === target && !d.open) this.sfx('hatch-clang', d.spec)
    }
    this.crowd.update(dt, h)
    this.folk.update(dt, h)
    for (const pool of this.pools.values()) {
      pool.level += (pool.target - pool.level) * Math.min(1, dt * 0.8)
      pool.mesh.position.y = pool.spec.floor + 0.05 + pool.level * pool.spec.depth
    }
    this.spinTrouvailles()
    this.slow -= dt
    if (this.slow <= 0) {
      this.slow = 0.5
      this.refreshState()
    }
  }

  private refreshState(): void {
    const st = this.ctx.state
    if (this.lanterns) {
      const c = new THREE.Color()
      this.lanterns.ids.forEach((id, i) => {
        const domes = (st.chart as { domes?: string[] }).domes ?? []
        const lit = domes.includes(id) || st.chart.sondes.includes(id) || !!st.flags[`dome:${id}`]
        this.lanterns!.im.setColorAt(i, lit ? c.set(PAL.lampe).multiplyScalar(1.6) : c.set(0x7fb8d8).multiplyScalar(0.9))
      })
      if (this.lanterns.im.instanceColor) this.lanterns.im.instanceColor.needsUpdate = true
    }
    this.found = new Set(st.trouvailles)
  }

  private found = new Set<string>()
  private readonly _sc = new THREE.Vector3()
  private spinTrouvailles(): void {
    const dirty = new Set<THREE.InstancedMesh>()
    for (const t of this.trouvailles) {
      const s = this.found.has(t.id) ? 0 : 1
      const bob = Math.sin(this.time * 1.6 + t.index) * 0.04
      t.im.setMatrixAt(t.index, _m.compose(_v.set(t.local.x, t.local.y + bob, t.local.z), _q.setFromAxisAngle(UP, this.time * 0.6 + t.index), this._sc.setScalar(s)))
      dirty.add(t.im)
    }
    for (const im of dirty) im.instanceMatrix.needsUpdate = true
  }

  writeLamps(ref: Vec3, cell: CellDef | null): void {
    const render = this.ctx.services.render
    if (!render) return
    this.group.updateMatrixWorld()
    const slots = render.uniforms.uLamps.value
    const colors = render.uniforms.uLampColors.value
    const level = this.ctx.quality.level
    const max = Math.min(slots.length, level === 'high' ? 8 : level === 'medium' ? 6 : 4)
    const near: LiveLamp[] = []
    const vis = this.visible
    for (const l of this.lamps) {
      if (l.district !== 'liens' && vis && !vis.has(l.district)) continue
      if (l.district !== 'liens' && cell && !cell.pvs.includes(l.district) && !(vis?.has(l.district) ?? false)) continue
      l.world.copy(l.local).applyMatrix4(this.group.matrixWorld)
      near.push(l)
    }
    const d2 = (v: THREE.Vector3) => (v.x - ref.x) ** 2 + (v.y - ref.y) ** 2 + (v.z - ref.z) ** 2
    near.sort((a, b) => d2(a.world) - d2(b.world))
    for (let i = 0; i < slots.length; i++) {
      const l = i < max ? near[i] : undefined
      if (!l) {
        slots[i]!.set(0, 0, 0, 0)
        continue
      }
      slots[i]!.set(l.world.x, l.world.y, l.world.z, l.radius)
      colors[i]?.copy(l.color)
    }
  }

  glowOfHull(h: { district: DistrictId; x: number; y: number; z: number; h: number; yaw: number }): { glow: [number, number, number]; sky: number } {
    const k = this.build.kits.get(h.district)!
    const hall = this.build.halls.find((x) => x.district === h.district)
    let nx = 0
    let nz = 0
    if (hall) {
      if (Math.abs(h.x - hall.x0) < 0.5) nx = 1
      else if (Math.abs(h.x - hall.x1) < 0.5) nx = -1
      else if (Math.abs(h.z - hall.z0) < 0.5) nz = 1
      else nz = -1
    }
    const px = h.x + nx * 3.4
    const pz = h.z + nz * 3.4
    const py = h.y + h.h * 0.15
    const bake: BakeLamp[] = k.lamps.map((l) => ({ x: l.x, y: l.y, z: l.z, color: new THREE.Color(l.color), radius: l.radius * 1.3, power: 0.5 * l.bake }))
    const c = lightAt(px, py, pz, nx, 0.3, nz, bake, new THREE.Color(BASE[h.district]).multiplyScalar(1.1), new THREE.Color())
    const sky = hall ? skyAt(py, 0.3, { y0: hall.floorY - 2, y1: hall.spring + hall.rise, color: new THREE.Color(), power: 0.32 }) : 0
    return { glow: [c.r, c.g, c.b], sky }
  }

  dispose(): void {
    for (const d of this.districts.values()) {
      try {
        for (let i = 0; i < d.body.numColliders(); i++) this.ctx.physics.untag(d.body.collider(i))
        this.ctx.physics.world.removeRigidBody(d.body)
      } catch {
        /* world may be gone */
      }
    }
    this.districts.clear()
    for (const off of this.offs.splice(0)) off()
    this.crowd.dispose()
    this.folk.dispose()
    this.group.removeFromParent()
  }
}

function vol(c: CellDef): number {
  return c.boxes.reduce((s, b) => s + (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0), 0)
}

function segDist(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const l2 = abx * abx + aby * aby + abz * abz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2)) : 0
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z)
}

function signMesh(s: SignSpec): THREE.Mesh {
  const W = 512
  const H = Math.max(96, Math.round((W * s.h) / s.w))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const paper = `#${new THREE.Color(s.paper).getHexString()}`
  const ink = `#${new THREE.Color(s.ink).getHexString()}`
  g.fillStyle = paper
  g.fillRect(0, 0, W, H)
  g.strokeStyle = ink
  g.globalAlpha = 0.5
  g.lineWidth = 6
  g.strokeRect(10, 10, W - 20, H - 20)
  g.globalAlpha = 1
  g.fillStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const main = s.sub ? H * 0.42 : H * 0.52
  let size = Math.min(H * (s.sub ? 0.42 : 0.6), 110)
  g.font = `600 ${size}px Georgia, 'Times New Roman', serif`
  while (g.measureText(s.text).width > W - 50 && size > 12) {
    size -= 2
    g.font = `600 ${size}px Georgia, 'Times New Roman', serif`
  }
  g.fillText(s.text, W / 2, main)
  if (s.sub) {
    let sub = Math.min(H * 0.2, 44)
    g.font = `italic ${sub}px Georgia, serif`
    while (g.measureText(s.sub).width > W - 50 && sub > 10) {
      sub -= 2
      g.font = `italic ${sub}px Georgia, serif`
    }
    g.globalAlpha = 0.8
    g.fillText(s.sub, W / 2, H * 0.78)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: tex, color: 0xe8e0d0 }))
  m.position.set(s.x, s.y, s.z)
  m.rotation.y = Math.PI - s.yaw
  m.name = `panneau:${s.text}`
  return m
}
