import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { GameContext, Medium, RoomId, Vec3 } from '../../core/types'
import { INDOOR } from '../../core/tuning'
import { GeoBuilder } from '../builder'
import type { Mats } from '../materials'
import { NOISE_GLSL } from '../materials'
import { PAL } from '../palette'
import { SURF, surfacePatch } from '../surface'
import { blockerShape, createDoor, doorwayContains, openLeafShape, poseLeaf, type DoorRuntime } from './doors'
import { buildFurniture, emptyFurniture } from './furniture'
import { PARTS, RECT_WINDOWS, REBORD, ROOM_NEIGHBOURS, partTop, type PartDef } from './layout'
import { buildShell, ceilingAt } from './shell'
import type { ColliderSpec, DoorDef, PaneDef } from './types'

export type LockId = 'sas' | 'echelle-toit'

interface AirlockDef {
  chamber: string
  inner: string
  outer: string
  yMin: number
  yMax: number
  box: { x0: number; x1: number; z0: number; z1: number }
  spawnIn: Vec3
  spawnOut: Vec3
}

export const AIRLOCKS: Record<LockId, AirlockDef> = {
  sas: {
    chamber: 'sas-chambre', inner: 'sas-interieure', outer: 'sas-exterieure', yMin: 0, yMax: 2.78,
    box: { x0: -1.4, x1: 1.4, z0: 70.2, z1: 73.3 },
    spawnIn: { x: 0, y: 1.2, z: 72.2 }, spawnOut: { x: 0, y: 0.05, z: 71.4 },
  },
  'echelle-toit': {
    chamber: 'echelle-toit', inner: 'toit-interieure', outer: 'toit-exterieure', yMin: 3.0, yMax: 5.98,
    box: { x0: -2.8, x1: -1.8, z0: 64.1, z1: 65.1 },
    spawnIn: { x: -2.4, y: 4.6, z: 64.6 }, spawnOut: { x: -2.4, y: 3.05, z: 64.6 },
  },
}

interface AirlockRuntime {
  id: LockId
  def: AirlockDef
  level: number
  busy: Promise<void> | null
  water: THREE.Mesh
  passes: number
}

export interface PartRuntime {
  def: PartDef
  group: THREE.Group
  sway: THREE.Matrix4
  body: RAPIER.RigidBody
  detail: THREE.Object3D[]
  center: THREE.Vector3
  phase: number
  visible: boolean
  detailVisible: boolean
}

interface LampRt {
  part: string
  rest: THREE.Vector3
  pivot: THREE.Vector3
  cord: number
  color: THREE.Color
  baseColor: THREE.Color
  radius: number
  airlock?: LockId
  phase: number
  world: THREE.Vector3
  local: THREE.Vector3
  hidden: boolean
  night: boolean
}

interface PendRt { part: string; pivot: THREE.Vector3; cord: number; drop: number; scale: number; phase: number }

interface Timer { left: number; total: number; fast: LockId | null; resolve: (elapsed: number) => void }

const WATER_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorldPos;
${NOISE_GLSL}
void main() {
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.08, min(e.x, e.y));
  float n = dFbm(vUv * 6.0 + vec2(uTime * 0.3, -uTime * 0.2));
  float foam = clamp(edge * (0.6 + n), 0.0, 1.0);
  vec3 c = mix(uColor, vec3(0.95, 0.98, 0.96), foam * 0.85) + n * 0.06;
  gl_FragColor = vec4(c, mix(0.55, 0.9, foam));
}`

const STEAM_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vA;
void main() {
  float t = fract(uTime * 0.22 + aSeed);
  vec3 p = position + vec3(sin(aSeed * 40.0 + uTime) * 0.12 * t, t * 1.3, cos(aSeed * 23.0 + uTime * 0.7) * 0.12 * t);
  vA = smoothstep(0.0, 0.15, t) * (1.0 - t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (90.0 + 160.0 * t) / max(-mv.z, 0.5);
  gl_Position = projectionMatrix * mv;
}`
const STEAM_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA * 0.35;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), a);
}`

const FLOOR_LOOK: Record<Exclude<PartDef['floor'], 'none'>, { pat: number; color: number }> = {
  bois: { pat: SURF.planksX, color: 0x7a5c48 },
  tapis: { pat: SURF.planksZ, color: 0x6c5244 },
  carrelage: { pat: SURF.tiles, color: 0x8c8479 },
  metal: { pat: SURF.steel, color: 0x60636f },
}

const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

export interface QuarterTextures {
  board: THREE.Texture
  chart: THREE.Texture
  drawings: THREE.Texture
  menu: THREE.Texture
}

export class Quarter {
  readonly root = new THREE.Group()
  readonly parts = new Map<string, PartRuntime>()
  readonly furniture = emptyFurniture()
  readonly panes: PaneDef[] = []
  readonly doors = new Map<string, DoorRuntime>()
  readonly airlocks = new Map<LockId, AirlockRuntime>()
  private readonly colliderSpecs: ColliderSpec[] = []
  private readonly lamps: LampRt[] = []
  private readonly pends: PendRt[] = []
  private bulbs!: THREE.InstancedMesh
  private shades!: THREE.InstancedMesh
  private cords!: THREE.InstancedMesh
  private pots: THREE.InstancedMesh | null = null
  private readonly timers: Timer[] = []
  private readonly driven = new Set<string>()
  private readonly steamMats: THREE.ShaderMaterial[] = []
  private readonly waterMats: THREE.ShaderMaterial[] = []
  private readonly mat: THREE.Material
  private readonly glowMat: THREE.Material
  private visibleRooms = new Set<RoomId>()
  private indoorRoom: RoomId | null = null
  private time = 0
  private lastHeading: number | null = null
  private turnLean = 0
  readonly lampOrder: number[] = []
  readonly outsideBoard: { x: number; y: number; z: number } = { x: 3.03, y: 1.6, z: 66.0 }

  constructor(private readonly ctx: GameContext, private readonly mats: Mats, tex: QuarterTextures, pose: { position: Vec3; heading: number }) {
    this.root.name = 'drift-quarter'
    this.mat = mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, onShader: surfacePatch })
    this.glowMat = mats.water(new THREE.MeshBasicMaterial({ vertexColors: true }))
    const R = ctx.physics.rapier
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    let seed = 11
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    PARTS.forEach((def, i) => {
      const group = new THREE.Group()
      group.name = `piece:${def.id}`
      group.matrixAutoUpdate = false
      const b = new GeoBuilder()
      const fade = new GeoBuilder()
      const glowB = new GeoBuilder()
      glowB.jitter = 0
      const fy = def.floorY
      b.shade = (p, n) => {
        const low = THREE.MathUtils.smoothstep(p.y, fy, fy + 0.9)
        const up = n.y > 0.5 ? 1.05 : 1
        return (0.72 + 0.28 * low) * up
      }
      fade.shade = b.shade
      const shellOut = { colliders: this.colliderSpecs, doors: [] as DoorDef[], panes: this.panes }
      buildShell(def, b, shellOut)
      buildFurniture(def.id, b, fade, this.furniture, rand, glowB)
      const staticMesh = new THREE.Mesh(b.build(), this.mat)
      staticMesh.name = `piece:${def.id}:coque`
      group.add(staticMesh)
      const detail: THREE.Object3D[] = []
      if (fade.vertexCount > 0) {
        const fm = new THREE.Mesh(fade.build(), this.mat)
        fm.userData.fadeable = true
        group.add(fm)
        detail.push(fm)
      }
      if (glowB.vertexCount > 0) {
        const gm = new THREE.Mesh(glowB.build(), this.glowMat)
        gm.name = `piece:${def.id}:lueur`
        group.add(gm)
        detail.push(gm)
      }
      if (def.floor !== 'none') {
        const fb = new GeoBuilder()
        fb.jitter = 0
        const w = def.x1 - def.x0 - 0.4
        const d = def.z1 - def.z0 - 0.4
        const g = new THREE.PlaneGeometry(w, d, Math.max(2, Math.ceil(w / 0.5)), Math.max(2, Math.ceil(d / 0.5)))
        g.rotateX(-Math.PI / 2)
        const fx = (def.x0 + def.x1) / 2
        const fz = (def.z0 + def.z1) / 2
        fb.shade = (p) => {
          const e = Math.min(p.x - def.x0, def.x1 - p.x, p.z - def.z0, def.z1 - p.z)
          const n = Math.sin(p.x * 1.7 + p.z * 0.6) * Math.sin(p.z * 2.3 - p.x * 0.4)
          return (0.5 + 0.5 * THREE.MathUtils.smoothstep(e, 0.15, 1.8)) * (0.94 + 0.06 * n)
        }
        const look = FLOOR_LOOK[def.floor]
        fb.pat = look.pat
        fb.add(g, new THREE.Matrix4().makeTranslation(fx, fy + 0.012, fz), look.color)
        const fl = new THREE.Mesh(fb.build(), this.mat)
        fl.name = `piece:${def.id}:sol`
        fl.matrixAutoUpdate = false
        group.add(fl)
        detail.push(fl)
      }
      const body = ctx.physics.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(pose.position.x, pose.position.y, pose.position.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      )
      const center = new THREE.Vector3((def.x0 + def.x1) / 2, fy, (def.z0 + def.z1) / 2)
      const rt: PartRuntime = { def, group, sway: new THREE.Matrix4(), body, detail, center, phase: i * 0.9, visible: true, detailVisible: true }
      this.parts.set(def.id, rt)
      this.root.add(group)
      for (const d of shellOut.doors) {
        const open = ctx.state.drift.doors[d.id] ?? DEFAULT_DOORS[d.id] ?? false
        const door = createDoor(d, this.mat, group, open)
        detail.push(door.leaf)
        this.doors.set(d.id, door)
      }
    })
    for (const spec of [...this.colliderSpecs, ...this.furniture.colliders]) this.addCollider(spec)
    for (const door of this.doors.values()) this.syncDoorColliders(door)
    this.normaliseAirlocks()
    this.buildLamps()
    this.buildPendulums()
    this.buildDecals(tex)
    this.buildSteam()
    this.buildAirlocks()
  }

  private groups(): number {
    const g = this.ctx.physics.groups
    return ((g.TERRAIN & 0xffff) << 16) | 0xffff
  }

  private addCollider(spec: ColliderSpec): RAPIER.Collider {
    const R = this.ctx.physics.rapier
    const part = this.parts.get(spec.part)!
    const desc = R.ColliderDesc.cuboid(Math.max(0.01, spec.hx), Math.max(0.01, spec.hy), Math.max(0.01, spec.hz))
      .setTranslation(spec.x, spec.y, spec.z)
      .setCollisionGroups(this.groups())
    if (spec.q) desc.setRotation({ x: spec.q.x, y: spec.q.y, z: spec.q.z, w: spec.q.w })
    const c = this.ctx.physics.world.createCollider(desc, part.body)
    this.ctx.physics.tag(c, { kind: spec.kind, climbable: spec.climbable, ...(spec.ownerId ? { ownerId: spec.ownerId } : {}) })
    return c
  }

  private removeCollider(c: RAPIER.Collider | null): null {
    if (!c) return null
    this.ctx.physics.untag(c)
    this.ctx.physics.world.removeCollider(c, true)
    return null
  }

  private syncDoorColliders(d: DoorRuntime): void {
    const closed = d.t < 0.5
    if (closed && !d.blocker) {
      d.openLeaf = this.removeCollider(d.openLeaf)
      const s = blockerShape(d)
      d.blocker = this.addCollider({ part: d.def.part, kind: 'door', climbable: false, ownerId: d.def.id, ...s })
    } else if (!closed && d.blocker) {
      d.blocker = this.removeCollider(d.blocker)
      const s = openLeafShape(d)
      if (s) d.openLeaf = this.addCollider({ part: d.def.part, kind: 'door', climbable: false, ownerId: d.def.id, ...s })
    }
  }

  private normaliseAirlocks(): void {
    for (const id of ['sas', 'echelle-toit'] as LockId[]) {
      const def = AIRLOCKS[id]
      const inner = this.doors.get(def.inner)!
      const outer = this.doors.get(def.outer)!
      if (outer.open) this.setDoorInstant(inner, false)
      const level = outer.open ? 1 : 0
      this.airlocks.set(id, { id, def, level, busy: null, water: null as unknown as THREE.Mesh, passes: 0 })
    }
  }

  private setDoorInstant(d: DoorRuntime, open: boolean): void {
    d.open = open
    d.t = open ? 1 : 0
    poseLeaf(d)
    this.syncDoorColliders(d)
    this.ctx.state.drift.doors[d.def.id] = open
  }

  private buildAirlocks(): void {
    for (const a of this.airlocks.values()) {
      const b = a.def.box
      const g = new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0)
      g.rotateX(-Math.PI / 2)
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(PAL.eauSas) } },
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      this.waterMats.push(m)
      const mesh = new THREE.Mesh(g, m)
      mesh.position.set((b.x0 + b.x1) / 2, a.def.yMin, (b.z0 + b.z1) / 2)
      mesh.renderOrder = 2
      this.parts.get(a.def.chamber)!.group.add(mesh)
      a.water = mesh
    }
  }

  private buildLamps(): void {
    for (const l of this.furniture.lamps) {
      const rest = new THREE.Vector3(l.x, l.y, l.z)
      this.lamps.push({
        part: l.part, rest, pivot: rest.clone().add(new THREE.Vector3(0, l.cord, 0)), cord: l.cord,
        color: new THREE.Color(l.color), baseColor: new THREE.Color(l.color), radius: l.radius,
        ...(l.airlock ? { airlock: l.airlock } : {}),
        phase: Math.random() * 6.28, world: new THREE.Vector3(), local: rest.clone(),
        hidden: !!l.hidden, night: !!l.night,
      })
    }
    const n = this.lamps.length
    const bulbMat = this.mats.water(new THREE.MeshBasicMaterial({ color: 0xffffff }))
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), bulbMat, n)
    const shadeGeo = new THREE.ConeGeometry(0.2, 0.16, 12, 1, true)
    shadeGeo.translate(0, 0.07, 0)
    this.shades = new THREE.InstancedMesh(shadeGeo, this.mats.cel({ color: PAL.laiton, side: THREE.DoubleSide, indoor: true }), n)
    const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4)
    cordGeo.translate(0, 0.5, 0)
    this.cords = new THREE.InstancedMesh(cordGeo, this.mats.cel({ color: PAL.boisOmbre, indoor: true }), n)
    for (const im of [this.bulbs, this.shades, this.cords]) {
      im.frustumCulled = false
      im.userData.fadeable = true
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.root.add(im)
    }
    for (let i = 0; i < n; i++) this.bulbs.setColorAt(i, this.lamps[i]!.color)
  }

  private buildPendulums(): void {
    for (const p of this.furniture.pendulums) {
      this.pends.push({ part: p.part, pivot: new THREE.Vector3(p.x, p.y, p.z), cord: p.cord, drop: p.drop ?? p.cord, scale: p.scale, phase: Math.random() * 6 })
    }
    if (this.pends.length === 0) return
    const b = new GeoBuilder()
    b.jitter = 0
    b.pat = SURF.brass
    b.cyl(0, -0.2, 0, 0.13, 0.18, 0xb8744a)
    b.cyl(0, -0.11, 0, 0.14, 0.025, 0xd9a06a)
    b.cyl(0, -0.29, 0, 0.12, 0.02, 0x7a4632)
    b.add(new THREE.TorusGeometry(0.135, 0.008, 4, 14, Math.PI), new THREE.Matrix4().makeTranslation(0, -0.11, 0), 0x6a5a5a)
    b.cyl(0.2, -0.17, 0, 0.012, 0.16, 0x5e4a5c, 'x')
    const g = b.build()
    this.pots = new THREE.InstancedMesh(g, this.mats.cel({ color: 0xffffff, vertexColors: true, indoor: true, onShader: surfacePatch }), this.pends.length)
    this.pots.frustumCulled = false
    this.pots.userData.fadeable = true
    this.root.add(this.pots)
  }

  private buildDecals(tex: QuarterTextures): void {
    const add = (part: string, kind: 'board' | 'chart' | 'drawings' | 'menu', x: number, y: number, z: number, w: number, h: number, normal: THREE.Vector3, up: THREE.Vector3) => {
      const map = kind === 'board' ? tex.board : kind === 'chart' ? tex.chart : kind === 'menu' ? tex.menu : tex.drawings
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mats.cel({ color: 0xffffff, map, indoor: true }))
      const right = new THREE.Vector3().crossVectors(up, normal)
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal))
      m.position.set(x, y, z).addScaledVector(normal, 0.012)
      m.updateMatrix()
      m.matrixAutoUpdate = false
      m.name = `decal:${kind}`
      const p = this.parts.get(part)!
      p.group.add(m)
      p.detail.push(m)
    }
    for (const d of this.furniture.decals) add(d.part, d.kind, d.x, d.y, d.z, d.w, d.h, d.normal, d.up)
    const o = this.outsideBoard
    add('sas', 'board', o.x, o.y, o.z, 1.3, 0.75, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))
  }

  private buildSteam(): void {
    for (const s of this.furniture.steam) {
      const n = 18
      const pos = new Float32Array(n * 3)
      const seeds = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = s.x + (Math.random() - 0.5) * 0.4
        pos[i * 3 + 1] = s.y
        pos[i * 3 + 2] = s.z + (Math.random() - 0.5) * 0.4
        seeds[i] = i / n
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: STEAM_VERT,
        fragmentShader: STEAM_FRAG,
        transparent: true,
        depthWrite: false,
      })
      this.steamMats.push(m)
      const pts = new THREE.Points(g, m)
      pts.frustumCulled = false
      const p = this.parts.get(s.part)!
      p.group.add(pts)
      p.detail.push(pts)
    }
  }

  owned(): readonly { ownerId: string; x: number; y: number; z: number }[] {
    return [...this.colliderSpecs, ...this.furniture.colliders].filter((c) => !!c.ownerId).map((c) => ({ ownerId: c.ownerId!, x: c.x, y: c.y, z: c.z }))
  }

  partAt(l: Vec3): PartDef | null {
    for (const id of ['echelle-toit', 'sas-chambre']) {
      const p = this.parts.get(id)!.def
      if (inside(p, l)) return p
    }
    for (const rt of this.parts.values()) if (inside(rt.def, l)) return rt.def
    return null
  }

  roomAt(l: Vec3): RoomId | null {
    const R = REBORD
    if (l.x > R.x0 && l.x < R.x1 && l.z > R.z0 && l.z < R.z1 && l.y > R.y0 && l.y < R.y1) return 'rebord'
    return this.partAt(l)?.room ?? null
  }

  mediumAt(l: Vec3): Medium {
    for (const a of this.airlocks.values()) {
      const b = a.def.box
      const inBox = l.x > b.x0 - 0.05 && l.x < b.x1 + 0.05 && l.z > b.z0 - 0.05 && l.z < b.z1 + 0.05 && l.y > a.def.yMin - 0.3 && l.y < a.def.yMax + 0.4
      if (inBox || this.partAt(l)?.id === a.def.chamber) return l.y < this.waterY(a) ? 'water' : 'air'
    }
    return this.partAt(l) ? 'air' : 'water'
  }

  private waterY(a: AirlockRuntime): number {
    if (a.level <= 0.001) return -Infinity
    if (a.level >= 0.999) return Infinity
    return a.def.yMin + a.level * (a.def.yMax - a.def.yMin)
  }

  ceilingAt(l: Vec3): number | null {
    const p = this.partAt(l)
    if (!p) return null
    return ceilingAt(p, l.x, l.z)
  }

  swayOf(partId: string): THREE.Matrix4 {
    return this.parts.get(partId)?.sway ?? IDENTITY
  }

  isDetailVisible(partId: string): boolean {
    return this.parts.get(partId)?.detailVisible ?? false
  }

  isPartVisible(partId: string): boolean {
    return this.parts.get(partId)?.visible ?? false
  }

  get currentIndoorRoom(): RoomId | null {
    return this.indoorRoom
  }

  openDoor(id: string, open: boolean): void {
    const d = this.doors.get(id)
    if (!d) return
    for (const a of this.airlocks.values()) {
      if (a.busy && (a.def.inner === id || a.def.outer === id)) return
      if (open && a.def.inner === id && a.level > 0.01) return
      if (open && a.def.outer === id && a.level < 0.99) return
    }
    this.animateDoor(d, open, 1.5)
  }

  private animateDoor(d: DoorRuntime, open: boolean, duration: number): Promise<void> {
    if (d.open === open && (open ? d.t >= 1 : d.t <= 0)) return Promise.resolve()
    if (d.open !== open) {
      d.open = open
      this.ctx.state.drift.doors[d.def.id] = open
      this.ctx.bus.emit('door:changed', { doorId: d.def.id, open })
      this.sfx('hatch-wheel', d)
    }
    d.duration = duration
    return new Promise((resolve) => d.waiters.push(resolve))
  }

  private sfx(id: string, d?: DoorRuntime): void {
    const audio = this.ctx.services.audio
    if (!audio) return
    try {
      if (d) {
        const p = new THREE.Vector3().copy(d.hinge).applyMatrix4(this.root.matrixWorld)
        audio.sfx(id, { x: p.x, y: p.y, z: p.z })
      } else {
        audio.sfx(id)
      }
    } catch {
      /* audio is optional */
    }
  }

  private wait(seconds: number, lock: LockId | null): Promise<number> {
    return new Promise((resolve) => this.timers.push({ left: seconds, total: seconds, fast: lock, resolve }))
  }

  heroInChamber(lock: LockId, heroLocal: Vec3): boolean {
    const b = AIRLOCKS[lock].box
    const a = AIRLOCKS[lock]
    return heroLocal.x > b.x0 - 0.2 && heroLocal.x < b.x1 + 0.2 && heroLocal.z > b.z0 - 0.2 && heroLocal.z < b.z1 + 0.2 && heroLocal.y > a.yMin - 0.5 && heroLocal.y < a.yMax + 0.5
  }

  cycleAirlock(lock: LockId, dir: 'in' | 'out', placeHero: (local: Vec3) => void, heroLocal: () => Vec3): Promise<void> {
    const a = this.airlocks.get(lock)!
    if (a.busy) return a.busy
    const emit = (phase: 'close' | 'pump' | 'open' | 'done') => this.ctx.bus.emit('airlock:cycle', { lockId: lock, dir, phase })
    const inner = this.doors.get(a.def.inner)!
    const outer = this.doors.get(a.def.outer)!
    const run = async () => {
      if (dir === 'in') {
        if (a.level < 0.99) {
          this.setDoorInstant(inner, false)
          a.level = 1
          this.setDoorInstant(outer, true)
        }
        if (!this.heroInChamber(lock, heroLocal()) || this.inDoorway(outer, heroLocal())) placeHero(a.def.spawnIn)
        emit('close')
        this.sfx('hatch-clang', outer)
        await this.animateDoorTimed(outer, false, 1.2, lock)
        emit('pump')
        this.sfx('pump', outer)
        await this.pump(a, 0, 3.6, lock)
        emit('open')
        await this.animateDoorTimed(inner, true, 1.2, lock)
      } else {
        if (a.level > 0.01) {
          this.setDoorInstant(outer, false)
          a.level = 0
        }
        if (!this.heroInChamber(lock, heroLocal()) || this.inDoorway(inner, heroLocal())) placeHero(a.def.spawnOut)
        emit('close')
        this.sfx('hatch-clang', inner)
        await this.animateDoorTimed(inner, false, 1.2, lock)
        emit('pump')
        this.sfx('bubbles', inner)
        await this.pump(a, 1, 3.6, lock)
        emit('open')
        await this.animateDoorTimed(outer, true, 1.2, lock)
      }
      a.passes++
      emit('done')
    }
    a.busy = run().finally(() => {
      a.busy = null
    })
    return a.busy
  }

  private inDoorway(d: DoorRuntime, l: Vec3): boolean {
    return doorwayContains(d, _v2.set(l.x, l.y, l.z), 0.35)
  }

  private async animateDoorTimed(d: DoorRuntime, open: boolean, seconds: number, lock: LockId): Promise<void> {
    this.driven.add(d.def.id)
    void this.animateDoor(d, open, seconds)
    await this.wait(seconds, lock)
    this.driven.delete(d.def.id)
    d.open = open
    d.t = open ? 1 : 0
    poseLeaf(d)
    this.syncDoorColliders(d)
  }

  private async pump(a: AirlockRuntime, target: number, seconds: number, lock: LockId): Promise<void> {
    const from = a.level
    let t = 0
    while (t < seconds) {
      t += await this.wait(1 / 30, lock)
      a.level = from + (target - from) * THREE.MathUtils.smootherstep(t / seconds, 0, 1)
    }
    a.level = target
  }

  private speedFor(lock: LockId | null): number {
    if (!lock) return 1
    const a = this.airlocks.get(lock)!
    return a.passes > 0 && this.ctx.input.down('interact') ? INDOOR.airlockFastMul : 1
  }

  update(dt: number, pose: { position: Vec3; heading: number; velocity: Vec3 }, heroLocal: Vec3, cameraLocal: Vec3, jumped: boolean): void {
    this.time += dt
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]!
      t.left -= dt * this.speedFor(t.fast)
      if (t.left <= 0) {
        this.timers.splice(i, 1)
        t.resolve(t.total - t.left)
      }
    }

    const q = _q.setFromAxisAngle(_v.set(0, 1, 0), -pose.heading)
    for (const p of this.parts.values()) {
      if (jumped) {
        p.body.setTranslation(pose.position, true)
        p.body.setRotation(q, true)
      } else {
        p.body.setNextKinematicTranslation(pose.position)
        p.body.setNextKinematicRotation(q)
      }
    }

    if (this.lastHeading !== null && !jumped) {
      let dh = pose.heading - this.lastHeading
      dh = Math.atan2(Math.sin(dh), Math.cos(dh))
      const rate = dt > 0 ? dh / dt : 0
      this.turnLean += (THREE.MathUtils.clamp(rate * 80, -0.02, 0.02) - this.turnLean) * Math.min(1, dt * 0.5)
    }
    this.lastHeading = pose.heading

    const deg = Math.PI / 180
    for (const p of this.parts.values()) {
      const k = p.def.swayMul
      const roll = (0.5 * deg * Math.sin((this.time * Math.PI * 2) / 11 + p.phase) + this.turnLean) * k
      const pitch = 0.3 * deg * k * Math.sin((this.time * Math.PI * 2) / 13.3 + p.phase * 1.3)
      _e.set(pitch, 0, roll)
      _q.setFromEuler(_e)
      p.sway.makeTranslation(p.center.x, p.center.y, p.center.z)
      p.sway.multiply(_m.makeRotationFromQuaternion(_q))
      p.sway.multiply(_m.makeTranslation(-p.center.x, -p.center.y, -p.center.z))
      p.group.matrix.copy(p.sway)
      p.group.matrixWorldNeedsUpdate = true
    }

    for (const d of this.doors.values()) {
      const target = d.open ? 1 : 0
      if (d.t !== target) {
        const step = dt / Math.max(0.1, d.duration)
        if (!d.open && !this.driven.has(d.def.id) && d.t > 0 && d.t <= 0.55 && doorwayContains(d, _v2.set(heroLocal.x, heroLocal.y, heroLocal.z))) {
          d.open = true
          this.ctx.state.drift.doors[d.def.id] = true
          this.ctx.bus.emit('door:changed', { doorId: d.def.id, open: true })
        }
        d.t = d.open ? Math.min(1, d.t + step) : Math.max(0, d.t - step)
        poseLeaf(d)
        this.syncDoorColliders(d)
        if (d.t === target) {
          if (!d.open) this.sfx('hatch-clang', d)
          for (const w of d.waiters.splice(0)) w()
        }
      }
    }

    for (const a of this.airlocks.values()) {
      const y = a.def.yMin + a.level * (a.def.yMax - a.def.yMin)
      a.water.position.y = y
      a.water.visible = a.level > 0.01 && a.level < 0.99
    }
    for (const m of this.waterMats) m.uniforms.uTime!.value = this.time
    for (const m of this.steamMats) m.uniforms.uTime!.value = this.time

    this.updateVisibility(heroLocal, cameraLocal)
    this.updateLamps()
  }

  private updateVisibility(heroLocal: Vec3, cameraLocal: Vec3): void {
    const heroRoom = this.roomAt(heroLocal)
    const camRoom = this.roomAt(cameraLocal)
    const room = heroRoom ?? camRoom
    this.indoorRoom = heroRoom
    this.visibleRooms.clear()
    if (room) {
      this.visibleRooms.add(room)
      for (const n of ROOM_NEIGHBOURS[room] ?? []) this.visibleRooms.add(n)
      if (room === 'rebord') this.visibleRooms.add('refectoire')
    }
    for (const p of this.parts.values()) {
      if (room) {
        p.visible = this.visibleRooms.has(p.def.room)
        p.detailVisible = p.visible
      } else {
        p.visible = true
        const dx = Math.max(p.def.x0 - cameraLocal.x, 0, cameraLocal.x - p.def.x1)
        const dz = Math.max(p.def.z0 - cameraLocal.z, 0, cameraLocal.z - p.def.z1)
        const dy = Math.max(p.def.floorY - cameraLocal.y, 0, cameraLocal.y - partTop(p.def))
        p.detailVisible = Math.hypot(dx, dy, dz) < 40 && GLAZED.has(p.def.id)
      }
      p.group.visible = p.visible
      for (const o of p.detail) o.visible = p.detailVisible
    }
  }

  private updateLamps(): void {
    const n = this.lamps.length
    const hours = this.ctx.state.time.hours
    const dim = hours >= 21 || hours < 5.5 ? 0.55 : hours >= 19 ? 0.8 : 1
    const night = hours >= 19 || hours < 5.5
    for (let i = 0; i < n; i++) {
      const l = this.lamps[i]!
      const part = this.parts.get(l.part)!
      const off = l.night && !night
      if (l.airlock) {
        const a = this.airlocks.get(l.airlock)!
        const idx = this.lamps.filter((o) => o.airlock === l.airlock).indexOf(l)
        const cnt = this.lamps.filter((o) => o.airlock === l.airlock).length
        const warm = 1 - a.level > (idx + 0.5) / (cnt + 0.5) ? 1 : 0
        l.color.set(PAL.froid).lerp(_c.set(PAL.lampe), warm)
      }
      const amp = l.cord > 0.05 ? 0.05 + Math.abs(part.def.swayMul - 1) * 0.04 : 0
      const w = Math.sqrt(9.81 / Math.max(0.2, l.cord))
      const ax = amp * Math.sin(this.time * w * 0.35 + l.phase)
      const az = amp * 0.7 * Math.sin(this.time * w * 0.3 + l.phase * 1.7)
      _e.set(ax, 0, az)
      _q.setFromEuler(_e)
      l.local.set(0, -l.cord, 0).applyQuaternion(_q).add(l.pivot)
      _m.compose(l.local, IDQ, _s.set(1, 1, 1))
      _m2.multiplyMatrices(part.sway, _m)
      if (!part.detailVisible || l.hidden) _m2.makeScale(0, 0, 0)
      this.bulbs.setMatrixAt(i, _m2)
      this.shades.setMatrixAt(i, _m2)
      _m.compose(l.local, _q, _s.set(1, l.cord, 1))
      _m2.multiplyMatrices(part.sway, _m)
      if (!part.detailVisible || l.cord < 0.05) _m2.makeScale(0, 0, 0)
      this.cords.setMatrixAt(i, _m2)
      this.bulbs.setColorAt(i, off ? _c.set(0x6a5a50) : _c.copy(l.color).multiplyScalar(0.6 + 0.4 * dim))
      l.world.copy(l.local).applyMatrix4(part.sway).applyMatrix4(this.root.matrixWorld)
    }
    this.bulbs.instanceMatrix.needsUpdate = true
    this.shades.instanceMatrix.needsUpdate = true
    this.cords.instanceMatrix.needsUpdate = true
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true

    if (this.pots) {
      this.pends.forEach((p, i) => {
        const part = this.parts.get(p.part)!
        const w = Math.sqrt(9.81 / p.cord)
        _e.set(0.06 * Math.sin(this.time * w * 0.3 + p.phase), 0, 0.08 * Math.sin(this.time * w * 0.27 + p.phase * 2))
        _q.setFromEuler(_e)
        _v.set(0, -p.drop, 0).applyQuaternion(_q).add(p.pivot)
        _m.compose(_v, _q, _s.set(p.scale, p.scale, p.scale))
        _m2.multiplyMatrices(part.sway, _m)
        if (!part.detailVisible) _m2.makeScale(0, 0, 0)
        this.pots!.setMatrixAt(i, _m2)
      })
      this.pots.instanceMatrix.needsUpdate = true
    }

    const render = this.ctx.services.render
    if (!render) return
    const slots = render.uniforms.uLamps.value
    const colors = render.uniforms.uLampColors.value
    const level = this.ctx.quality.level
    const max = Math.min(slots.length, level === 'high' ? 8 : level === 'medium' ? 6 : 4)
    const ref = this.ctx.state.hero.position
    this.lampOrder.length = 0
    for (let i = 0; i < n; i++) {
      const l = this.lamps[i]!
      if (this.parts.get(l.part)!.visible && !(l.night && !night)) this.lampOrder.push(i)
    }
    this.lampOrder.sort((a, b) => dist2(this.lamps[a]!.world, ref) - dist2(this.lamps[b]!.world, ref))
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      const li = i < max ? this.lampOrder[i] : undefined
      if (li === undefined) {
        slot.set(0, 0, 0, 0)
        continue
      }
      const l = this.lamps[li]!
      slot.set(l.world.x, l.world.y, l.world.z, l.radius * dim)
      colors[i]?.copy(l.color)
    }
  }

  nearestLamps(ref: Vec3, count: number): { position: THREE.Vector3; color: THREE.Color; radius: number }[] {
    return [...this.lamps]
      .filter((l) => this.parts.get(l.part)!.visible)
      .sort((a, b) => dist2(a.world, ref) - dist2(b.world, ref))
      .slice(0, count)
      .map((l) => ({ position: l.world, color: l.color, radius: l.radius }))
  }

  dispose(): void {
    for (const p of this.parts.values()) {
      try {
        for (let i = 0; i < p.body.numColliders(); i++) this.ctx.physics.untag(p.body.collider(i))
        this.ctx.physics.world.removeRigidBody(p.body)
      } catch {
        /* world may be gone */
      }
    }
    this.parts.clear()
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
    this.root.removeFromParent()
  }
}

const GLAZED = new Set(RECT_WINDOWS.map((w) => w.part))
const IDENTITY = new THREE.Matrix4()
const IDQ = new THREE.Quaternion()

const DEFAULT_DOORS: Record<string, boolean> = {
  'porte-cabine': false,
  'porte-voisins': false,
  'porte-marche': true,
  'porte-cartes': false,
  'porte-nef': false,
  'porte-grand-marche': false,
  'sas-interieure': true,
  'sas-exterieure': false,
  'toit-interieure': false,
  'toit-exterieure': false,
}

function inside(p: PartDef, l: Vec3): boolean {
  return l.x > p.x0 && l.x < p.x1 && l.z > p.z0 && l.z < p.z1 && l.y > p.floorY - 0.3 && l.y < partTop(p)
}

function dist2(a: THREE.Vector3, b: Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}
