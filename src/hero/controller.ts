import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { HERO_MAX_Y, TETHER } from '../core/layout'
import { INDOOR, MOVE } from '../core/tuning'
import type { ColliderKind, ColliderTag, GameContext, HeroMode, Medium, RoomId, Vec3 } from '../core/types'
import { AnchorBook, closestOnSegment, type HeroAnchor } from './anchors'
import type { ClipId, GestureClip } from './anim'
import type { CameraStyle } from './camera'

export type PublicMode = HeroMode | 'run' | 'jump' | 'land' | 'zip' | 'tube' | 'slide' | 'carry'

const T = {
  sprint: 5.5,
  sprintCost: 0.1,
  jumpHeight: 1.2,
  carryJump: 0.5,
  coyote: 0.12,
  buffer: 0.12,
  riseGravity: 1.35,
  fallGravity: 1.9,
  cutGravity: 3.2,
  climbSpeed: 1.2,
  climbCostMoving: 0.08,
  climbCostHanging: 0.02,
  climbJump: 1.8,
  climbJumpCost: 0.18,
  ladder: 1.6,
  ladderFast: 2.6,
  ladderSlide: 4.5,
  zipMax: 9,
  zipCost: 0.03,
  zipHang: 1.95,
  zipReach: 0.9,
  toileForward: 5,
  toileFall: 1.2,
  toileCost: 0.04,
  slideMin: 3,
  slideMax: 11,
  rollFall: 4,
  hardFall: 8,
  rollCost: 0.2,
  hardCost: 0.4,
  swim: 3,
  swimSprint: 5,
  swimVertical: 2,
  swimSprintCost: 0.12,
  hullClimb: 1.4,
  hullClimbCost: 0.06,
  reel: 4,
  pullBack: 3,
} as const

const PARK = { x: 0, y: -5000, z: 0 }
const CAP_HALF = 0.5
const CAP_R = 0.3
const CAP_CENTER = CAP_HALF + CAP_R
const CHEST = 1.15
const SEAT_DROP = 0.43
const WALK_WATER_SLOPE = 50 * (Math.PI / 180)
const STEP_SURFACE: Partial<Record<ColliderKind, 'sable' | 'bois' | 'metal' | 'tapis'>> = {
  terrain: 'sable', rock: 'sable', coral: 'sable', shrine: 'sable',
  floor: 'bois', interior: 'bois', stair: 'bois', seat: 'bois', prop: 'bois', shelf: 'bois',
  wall: 'metal', hull: 'metal', 'hull-outside': 'metal', window: 'metal', glass: 'metal', door: 'metal',
  ladder: 'metal', pipe: 'metal', rib: 'metal', sonde: 'metal', net: 'tapis',
}
const EASY_CLIMB: ReadonlySet<ColliderKind> = new Set(['ladder', 'net', 'pipe', 'rib', 'shelf', 'prop', 'hull', 'hull-outside', 'rock', 'kelp'])
const IGNORE: readonly ColliderKind[] = ['trigger', 'fauna']
const UP = new THREE.Vector3(0, 1, 0)

type LadderA = Extract<HeroAnchor, { kind: 'ladder' }>
type ZipA = Extract<HeroAnchor, { kind: 'zip' }>
type SlideA = Extract<HeroAnchor, { kind: 'slide' }>

type Activity =
  | { kind: 'none' }
  | { kind: 'sit'; seatId: string; anchor: THREE.Vector3; yaw: number; stage: 'approach' | 'down' | 'sit' | 'up'; t: number; standAt: THREE.Vector3 }
  | { kind: 'lean'; target: THREE.Vector3; stage: 'in' | 'lean' | 'up'; t: number }
  | { kind: 'sleep'; stage: 'down' | 'sleep' | 'up'; t: number; bed: Vec3 | null; bedYaw: number; from: THREE.Vector3 }
  | { kind: 'ladder'; a: LadderA; s: number; topT: number; mountT: number }
  | { kind: 'zip'; a: ZipA; s: number; v: number; dir: 1 | -1; swing: number; swingV: number; lastV: number }
  | { kind: 'slide'; a: SlideA; cum: number[]; d: number; v: number; off: number; lastYaw: number }
  | { kind: 'tube'; stage: 'in' | 'out'; t: number }
  | { kind: 'roll'; t: number; dir: THREE.Vector3; hard: boolean }
  | { kind: 'gesture'; clip: GestureClip; t: number; dur: number }

const v3 = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z)
const forward = (yaw: number, out: THREE.Vector3) => out.set(Math.sin(yaw), 0, -Math.cos(yaw))
const yawOf = (x: number, z: number) => Math.atan2(x, -z)
function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
type EnduranceApi = { spend(c: number): boolean; drain(rate: number, dt: number): boolean; canAct(): boolean }
const isWet = (tag: ColliderTag | undefined) => (tag as (ColliderTag & { wet?: boolean }) | undefined)?.wet === true

export interface ControllerOut {
  clip: ClipId
  clipFade: number
  phase: number
  speed: number
  bank: number
  pitch: number
  climbX: number
  climbY: number
  swing: number
  scrubbing: boolean
  gliding: boolean
  sprinting: boolean
  moving: number
  inWater: boolean
  style: CameraStyle
  zipping: boolean
  freezeCamera: boolean
  lookAt: THREE.Vector3 | null
  lean: THREE.Vector3
}

export class HeroController {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  yaw = 0
  mode: PublicMode = 'idle'
  medium: Medium = 'water'
  room: RoomId | null = null
  wetness = 0
  grounded = false
  groundKind: ColliderKind = 'floor'
  groundNormal = new THREE.Vector3(0, 1, 0)
  gravity = new THREE.Vector3(0, -9.81, 0)
  headingDelta = 0
  carrying = false
  tetherAnchor = new THREE.Vector3()
  tetherLength = 0
  tetherActive = false
  readonly anchors: AnchorBook
  out: ControllerOut = {
    clip: 'idle-dry', clipFade: 0.22, phase: 0, speed: 0, bank: 0, pitch: 0, climbX: 0, climbY: 0, swing: 0,
    scrubbing: false, gliding: false, sprinting: false, moving: 0, inWater: false, style: 'walk', zipping: false,
    freezeCamera: false, lookAt: null, lean: new THREE.Vector3(),
  }

  private kcc: RAPIER.KinematicCharacterController
  private collider: RAPIER.Collider
  private lock: 'cutscene' | 'airlock' | null = null
  private scrubPose = false
  private climbing = false
  private gliding = false
  private climbN = new THREE.Vector3()
  private climbUp = new THREE.Vector3()
  private climbDelta = new THREE.Vector3()
  private climbJumpT = 99
  private climbJumpDir = new THREE.Vector3()
  private slipT = 0
  private slipping = 0
  private wallTag: ColliderTag | undefined
  private pushT = 0
  private mantleT = -1
  private mantleFrom = new THREE.Vector3()
  private mantleTo = new THREE.Vector3()
  private ledge = new THREE.Vector3()
  private landT = 99
  private hatchT = 99
  private shakeT = 99
  private skidT = 0
  private jumpT = 99
  private jumpBuffer = 0
  private coyote = 0
  private airT = 0
  private apexY = 0
  private vyF = 0
  private phase = 0
  private stepIdx = 0
  private yawRate = 0
  private lastSafeT = 0
  private lastSafeLocal: Vec3 | null = null
  private stuckT = 0
  private tautEmitted = false
  private pullT = 0
  private reeling: (() => void) | null = null
  private airlock: { dir: 'in' | 'out'; phase: 'close' | 'pump' | 'open' | 'done'; t: number } | null = null
  private activity: Activity = { kind: 'none' }
  private talking: string | null = null
  private recovering = false
  private localPos: THREE.Vector3 | null = null
  private lastHeading = 0
  private wasGrounded = false
  private hitWall = false
  private fallSpeed = 0
  private prevVel = new THREE.Vector3()
  private wish = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private tmp3 = new THREE.Vector3()
  private flow = new THREE.Vector3()
  private leanGoal = new THREE.Vector3()
  private near: HeroAnchor[] = []
  private stepCb: (left: boolean) => void = () => undefined
  private fader: ((mid: () => void) => Promise<void>) | null = null
  private unsubs: (() => void)[] = []

  constructor(private ctx: GameContext) {
    const R = ctx.physics.rapier
    const w = ctx.physics.world
    this.anchors = new AnchorBook(ctx)
    this.collider = w.createCollider(R.ColliderDesc.capsule(CAP_HALF, CAP_R).setTranslation(PARK.x, PARK.y, PARK.z))
    this.kcc = w.createCharacterController(0.03)
    this.kcc.setUp({ x: 0, y: 1, z: 0 })
    this.kcc.setSlideEnabled(true)
    this.kcc.setApplyImpulsesToDynamicBodies(false)
    this.kcc.setCharacterMass(60)

    const bus = ctx.bus
    this.unsubs.push(
      bus.on('airlock:cycle', (e) => this.onAirlock(e.dir, e.phase)),
      bus.on('interact', (e) => {
        const kind = e.kind as string
        if (kind === 'door') this.hatchT = 0
        else if (kind === 'ladder') this.grabLadder(e.targetId)
        else if (kind === 'zip') this.zip(e.targetId)
        else if (kind === 'valve') this.gesture('turn-valve', 1.4)
        else if (kind === 'pump') this.gesture('pump', 1.8)
        else if (kind === 'ring') this.clipRing(e.targetId)
      }),
      bus.on('dialogue:start', (e) => {
        this.talking = e.npcId
      }),
      bus.on('dialogue:end', () => {
        this.talking = null
      }),
      bus.on('sleep:done', () => {
        if (this.activity.kind === 'sleep') {
          this.activity.stage = 'up'
          this.activity.t = 0
        }
      }),
    )
  }

  onStep(cb: (left: boolean) => void): void {
    this.stepCb = cb
  }

  setFader(f: (mid: () => void) => Promise<void>): void {
    this.fader = f
  }

  dispose(): void {
    for (const u of this.unsubs) u()
    const w = this.ctx.physics.world
    w.removeCharacterController(this.kcc)
    w.removeCollider(this.collider, false)
  }

  loadFromState(): void {
    const h = this.ctx.state.hero
    const drift = this.ctx.services.drift
    this.wetness = h.wetness
    this.yaw = h.yaw
    if (h.medium === 'air' && drift) {
      this.medium = 'air'
      this.room = h.room
      if (h.localPosition) this.pos.copy(v3(drift.toWorld(h.localPosition)))
      else {
        const s = drift.roomSpawn(h.room ?? 'cabine')
        this.pos.copy(v3(s.position))
        this.yaw = s.yaw
      }
    } else {
      this.medium = 'water'
      this.room = null
      this.pos.copy(v3(h.position))
      this.wetness = 1
    }
    this.vel.set(0, 0, 0)
    this.mode = this.medium === 'air' ? 'idle' : 'swim'
    this.syncLocal()
  }

  teleport(p: Vec3, yaw?: number): void {
    this.mantleT = -1
    this.pos.set(p.x, p.y, p.z)
    this.vel.set(0, 0, 0)
    if (yaw !== undefined) this.yaw = yaw
    this.activity = { kind: 'none' }
    this.climbing = false
    this.gliding = false
    this.climbJumpT = 99
    this.reeling = null
    const drift = this.ctx.services.drift
    this.medium = drift ? drift.mediumAt(this.tmp.copy(this.pos).setY(this.pos.y + 1)) : 'water'
    if (this.medium === 'air') this.room = drift?.roomAt(this.pos) ?? this.ctx.state.hero.room
    if (this.medium === 'water') this.room = null
    this.wetness = this.medium === 'air' ? Math.min(this.wetness, this.ctx.state.hero.wetness) : 1
    this.publish(this.medium === 'air' ? 'idle' : 'swim')
    this.tautEmitted = false
    this.apexY = this.pos.y
    this.syncLocal()
    this.writeState()
  }

  private syncLocal(): void {
    const drift = this.ctx.services.drift
    if (drift && this.medium === 'air') {
      this.localPos = v3(drift.toLocal(this.pos))
      this.lastHeading = drift.pose().heading
    } else this.localPos = null
  }

  private publish(m: PublicMode): void {
    if (m === this.mode) return
    const from = this.mode
    this.mode = m
    this.ctx.bus.emit('hero:mode', { from: from as HeroMode, to: m as HeroMode })
  }

  setMode(m: HeroMode): void {
    switch (m) {
      case 'cutscene':
        if (this.activity.kind !== 'sit' && this.activity.kind !== 'lean') this.activity = { kind: 'none' }
        this.lock = 'cutscene'
        this.vel.set(0, 0, 0)
        break
      case 'airlock':
        this.activity = { kind: 'none' }
        this.climbing = false
        this.lock = 'airlock'
        this.vel.set(0, 0, 0)
        break
      case 'sleep':
        this.lock = null
        this.startSleep()
        break
      case 'ladder':
        this.lock = null
        this.grabLadder(null)
        return
      case 'climb':
        this.lock = null
        if (this.findWall(true)) this.startClimb()
        return
      case 'scrub':
        this.scrubPose = true
        break
      case 'idle': {
        const wasLocked = this.lock !== null
        this.lock = null
        this.scrubPose = false
        const a = this.activity
        if (a.kind === 'sleep' || a.kind === 'sit' || a.kind === 'lean') {
          if (!wasLocked) this.stand()
          return
        }
        if (a.kind === 'gesture') this.activity = { kind: 'none' }
        m = this.medium === 'air' ? 'idle' : 'swim'
        break
      }
      default:
        this.lock = null
        this.scrubPose = false
    }
    this.publish(m)
  }

  sit(seatId: string): void {
    const seat = this.ctx.services.drift?.seat(seatId)
    if (!seat) return
    this.activity = { kind: 'sit', seatId, anchor: v3(seat.position), yaw: seat.yaw, stage: 'approach', t: 0, standAt: new THREE.Vector3() }
  }

  lean(target: Vec3): void {
    this.activity = { kind: 'lean', target: v3(target), stage: 'in', t: 0 }
  }

  stand(): void {
    const a = this.activity
    if (a.kind === 'sit' && (a.stage === 'sit' || a.stage === 'down')) {
      a.stage = 'up'
      a.t = 0
    } else if (a.kind === 'lean' || a.kind === 'sleep') {
      a.stage = 'up'
      a.t = 0
    } else this.activity = { kind: 'none' }
  }

  gesture(clip: GestureClip, seconds: number): void {
    if (this.medium === 'air' && !this.grounded && this.activity.kind === 'none') return
    if (this.activity.kind !== 'none' && this.activity.kind !== 'gesture') return
    this.activity = { kind: 'gesture', clip, t: 0, dur: seconds }
  }

  setCarrying(on: boolean): void {
    this.carrying = on
    if (on && this.climbing) this.letGo(0.5)
  }

  zip(id: string): boolean {
    const local = this.localNow()
    const a = this.anchors.byId(id, local)
    if (!a || a.kind !== 'zip') return false
    const t = closestOnSegment(local, a.from, a.to, this.tmp)
    this.startZip(a, THREE.MathUtils.clamp(t, 0.02, 0.98))
    return true
  }

  slide(id: string): boolean {
    const a = this.anchors.byId(id, this.localNow())
    if (!a || a.kind !== 'slide' || a.path.length < 2) return false
    this.startSlide(a)
    return true
  }

  async tube(toLocal: Vec3, yaw: number): Promise<void> {
    if (this.medium !== 'air') return
    this.activity = { kind: 'tube', stage: 'in', t: 0 }
    this.vel.set(0, 0, 0)
    this.publish('tube')
    await new Promise((r) => setTimeout(r, 450))
    const go = () => {
      const drift = this.ctx.services.drift
      if (drift) {
        const heading = drift.pose().heading
        this.teleport(drift.toWorld(toLocal), yaw + heading)
      }
      this.activity = { kind: 'tube', stage: 'out', t: 0 }
      this.publish('tube')
    }
    if (this.fader) await this.fader(go)
    else go()
  }

  clipRing(id: string): boolean {
    const st = this.ctx.state
    if (st.mode !== 'sortie' || !st.hero.sortie) return false
    const a = this.anchors.byId(id, this.localNow())
    if (!a || a.kind !== 'ring') return false
    st.hero.sortie.ring = id
    this.tautEmitted = false
    this.activity = { kind: 'gesture', clip: 'clip-ring', t: 0, dur: 0.8 }
    return true
  }

  reelIn(): Promise<void> {
    if (this.ctx.state.mode !== 'sortie' || this.medium !== 'water') return Promise.resolve()
    this.climbing = false
    this.activity = { kind: 'none' }
    return new Promise((resolve) => {
      this.reeling = resolve
    })
  }

  get state(): Activity['kind'] | 'climb' | 'glide' {
    if (this.climbing) return 'climb'
    if (this.gliding) return 'glide'
    return this.activity.kind
  }

  update(dt: number, camYaw: number, camPitch: number): void {
    const ctx = this.ctx
    this.landT += dt
    this.hatchT += dt
    this.shakeT += dt
    this.climbJumpT += dt
    this.jumpT += dt
    this.skidT = Math.max(0, this.skidT - dt)
    const prevYaw = this.yaw
    this.prevVel.copy(this.vel)

    this.followDrift()
    this.computeGravity()
    this.updateMedium()

    const input = ctx.input
    const locked = this.lock !== null || ctx.clock.paused
    const mx = locked ? 0 : input.move.x
    const my = locked ? 0 : input.move.y
    const fx = Math.sin(camYaw)
    const fz = -Math.cos(camYaw)
    this.wish.set(fx * my + Math.cos(camYaw) * mx, 0, fz * my + Math.sin(camYaw) * mx)
    const wishLen = Math.min(1, this.wish.length())

    const out = this.out
    out.lookAt = null
    out.freezeCamera = false
    out.climbX = mx
    out.climbY = my
    out.swing = 0
    out.scrubbing = false
    out.gliding = false
    out.sprinting = false
    out.zipping = false
    out.pitch = 0
    out.style = this.medium === 'air' ? 'walk' : 'swim'
    this.leanGoal.set(0, 0, 0)

    if (this.mantleT >= 0) this.updateMantle(dt)
    else if (this.lock === 'airlock') this.updateAirlock(dt)
    else if (this.lock === 'cutscene' && this.activity.kind === 'none') this.updateCutscene(dt)
    else if (this.activity.kind !== 'none' && this.updateActivity(dt, wishLen, locked)) { /* handled */ }
    else if (this.medium === 'air') this.updateAir(dt, wishLen, locked)
    else this.updateWater(dt, wishLen, locked, my, camPitch)

    this.yawRate = angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-4)
    if ((out.style as CameraStyle) !== 'slide') out.bank += (THREE.MathUtils.clamp(-this.yawRate * 0.22, -0.7, 0.7) - out.bank) * Math.min(1, dt * 5)
    out.inWater = this.medium === 'water'
    out.gliding = this.gliding
    out.phase = this.phase
    if (this.talking) out.lookAt = this.npcLook()
    this.updateLean(dt)

    this.housekeeping(dt)
    this.writeState()
  }

  private followDrift(): void {
    this.headingDelta = 0
    const drift = this.ctx.services.drift
    if (!drift || this.medium !== 'air' || !this.localPos) return
    const w = drift.toWorld(this.localPos)
    this.pos.set(w.x, w.y, w.z)
    const pose = drift.pose()
    const dh = angleDiff(this.lastHeading, pose.heading)
    this.yaw += dh
    this.headingDelta = dh
    this.vel.applyAxisAngle(UP, -dh)
    this.lastHeading = pose.heading
  }

  private computeGravity(): void {
    const g = (this.ctx.physics as unknown as { gravity?: Vec3 }).gravity
    const drift = this.ctx.services.drift
    if (!g || !(g.x * g.x + g.y * g.y + g.z * g.z > 0.01)) {
      this.gravity.set(0, -9.81, 0)
      return
    }
    if (drift) {
      const h = drift.pose().heading
      this.gravity.set(g.x, g.y, g.z).applyAxisAngle(UP, -h)
    } else this.gravity.set(g.x, g.y, g.z)
  }

  private localNow(): Vec3 {
    const drift = this.ctx.services.drift
    return drift ? drift.toLocal(this.pos) : { x: this.pos.x, y: this.pos.y, z: this.pos.z }
  }

  private toW(local: Vec3, out: THREE.Vector3): THREE.Vector3 {
    const drift = this.ctx.services.drift
    const w = drift ? drift.toWorld(local) : local
    return out.set(w.x, w.y, w.z)
  }

  private updateMedium(): void {
    const drift = this.ctx.services.drift
    if (this.lock === 'airlock' || this.recovering) return
    const m: Medium = drift ? drift.mediumAt(this.tmp.copy(this.pos).setY(this.pos.y + 1)) : 'water'
    if (m === this.medium) {
      if (m === 'air' && drift) this.trackRoom(drift.roomAt(this.pos))
      return
    }
    if (this.medium === 'air' && m === 'water' && drift && this.ctx.state.mode === 'inside') {
      if (drift.cellAt(drift.toLocal(this.pos)) === null) {
        this.recover()
        return
      }
    }
    this.setMedium(m)
  }

  private setMedium(m: Medium): void {
    if (m === this.medium) return
    this.medium = m
    this.gliding = false
    if (m === 'water') {
      this.wetness = 1
      this.trackRoom(null)
      if (this.activity.kind !== 'gesture') this.activity = { kind: 'none' }
    } else {
      this.wetness = Math.max(this.wetness, 1)
      this.trackRoom(this.ctx.services.drift?.roomAt(this.pos) ?? this.room)
    }
    this.syncLocal()
    this.ctx.bus.emit('hero:medium', { medium: m })
  }

  private trackRoom(r: RoomId | null): void {
    if (r === this.room) return
    if (this.room) this.ctx.bus.emit('room:left', { roomId: this.room })
    this.room = r
    if (r) this.ctx.bus.emit('room:entered', { roomId: r })
  }

  private recover(): void {
    if (this.recovering) return
    const drift = this.ctx.services.drift
    if (!drift) return
    this.recovering = true
    const go = () => {
      if (this.lastSafeLocal) {
        this.pos.copy(v3(drift.toWorld(this.lastSafeLocal)))
      } else {
        const s = drift.roomSpawn(this.room ?? 'cabine')
        this.pos.copy(v3(s.position))
        this.yaw = s.yaw
      }
      this.vel.set(0, 0, 0)
      this.activity = { kind: 'none' }
      this.climbing = false
      this.gliding = false
      this.stuckT = 0
      this.medium = 'water'
      this.setMedium('air')
      this.recovering = false
    }
    if (this.fader) void this.fader(go)
    else go()
  }

  private endurance(): EnduranceApi | undefined {
    const g = this.ctx.services.gameplay as unknown as { endurance?: EnduranceApi; breath?: EnduranceApi } | undefined
    return g?.endurance ?? g?.breath
  }
  private canAct(): boolean {
    const b = this.endurance()
    return (b ? b.canAct() : true) && !this.ctx.state.hero.exhausted
  }
  private spend(c: number): boolean {
    const b = this.endurance()
    return b ? b.spend(c) : true
  }
  private drain(rate: number, dt: number): boolean {
    const b = this.endurance()
    return b ? b.drain(rate, dt) : true
  }
  private hasItem(id: string, fallback: boolean): boolean {
    const g = this.ctx.services.gameplay
    return g ? g.hasItem(id) : fallback
  }

  private ringWorld(out: THREE.Vector3): boolean {
    const st = this.ctx.state
    const lockId = st.hero.sortie?.lockId ?? 'sas'
    const ring = st.hero.sortie?.ring
    if (ring && ring !== lockId) {
      const a = this.anchors.byId(ring, this.localNow())
      if (a && a.kind === 'ring') {
        this.toW(a.at, out)
        return true
      }
    }
    const lock = this.ctx.services.drift?.lockAnchor(lockId)
    if (!lock) return false
    out.set(lock.x, lock.y, lock.z)
    return true
  }

  private applyTether(dt: number): void {
    const st = this.ctx.state
    if (st.mode !== 'sortie' || this.medium !== 'water' || !this.ringWorld(this.tetherAnchor)) {
      this.tetherActive = false
      this.tautEmitted = false
      return
    }
    this.tetherActive = true
    const off = this.tmp.copy(this.pos).sub(this.tetherAnchor)
    const d = off.length()
    this.tetherLength = d
    if (d <= TETHER.length) {
      this.tautEmitted = false
      this.pullT = 0
      return
    }
    off.multiplyScalar(1 / d)
    this.pos.copy(this.tetherAnchor).addScaledVector(off, TETHER.length)
    const radial = this.vel.dot(off)
    if (radial > 0) this.vel.addScaledVector(off, -radial)
    const pulling = this.wish.lengthSq() > 0.04 && this.wish.dot(off) > 0.3
    this.pullT = pulling ? this.pullT + dt : 0
    if (this.pullT > 0.7) {
      this.vel.addScaledVector(off, -T.pullBack * 2)
      this.pullT = -0.6
    }
    if (!this.tautEmitted) this.ctx.bus.emit('tether:taut', { length: TETHER.length })
    this.tautEmitted = true
  }

  private updateWater(dt: number, wishLen: number, locked: boolean, my: number, camPitch: number): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    const exhausted = ctx.state.hero.exhausted
    const slow = exhausted ? MOVE.exhaustedSpeedMul : 1
    const world = ctx.services.world
    if (world) {
      const c = world.currentAt(this.pos)
      this.flow.set(c.x, c.y, c.z)
    } else this.flow.set(ctx.state.env.current.x, ctx.state.env.current.y, ctx.state.env.current.z)
    out.style = 'swim'

    if (this.reeling) {
      const to = this.tmp2.copy(this.tetherAnchor).sub(this.pos)
      const d = to.length()
      if (d < 1.5 || !this.tetherActive) {
        const done = this.reeling
        this.reeling = null
        done()
      } else {
        this.vel.copy(to).multiplyScalar(T.reel / d)
        this.yaw += angleDiff(this.yaw, yawOf(-to.x, -to.z)) * Math.min(1, dt * 4)
        this.moveKcc(dt, 0, 0)
        out.speed = 0
        out.moving = 0
        this.clip('climb-idle', 0.3)
        return
      }
    }
    if (this.scrubPose) {
      this.poseScrub(dt)
      return
    }
    if (this.climbing) {
      this.updateClimb(dt, locked)
      return
    }
    let sprint = !locked && input.down('sprint') && wishLen > 0.1 && !exhausted
    if (sprint && !this.drain(T.swimSprintCost, dt)) sprint = false
    const speed = (sprint ? T.swimSprint : T.swim) * slow * wishLen
    out.sprinting = sprint
    this.steerHorizontal(dt, speed, sprint ? 3.5 : 4.5, sprint ? 3 : 5)
    let targetVy = 0
    if (!locked && input.down('up')) targetVy = T.swimVertical
    if (!locked && input.down('down')) targetVy = -T.swimVertical
    if (my > 0.1 && targetVy === 0) targetVy = -Math.sin(camPitch) * 0.7 * speed
    this.vel.y += (targetVy - this.vel.y) * Math.min(1, 3 * dt)
    if (!locked && input.pressed('up') && this.wallAhead(0.8) && this.canAct()) {
      this.startClimb()
      return
    }
    if (wishLen > 0.3 && this.canAct() && this.wallAhead(0.5, true) && EASY_CLIMB.has(this.wallTag?.kind ?? 'hull')) {
      this.startClimb()
      return
    }
    this.publish(exhausted ? 'exhausted' : 'swim')
    out.pitch = THREE.MathUtils.clamp(this.vel.y / 4, -0.6, 0.7)
    this.moveKcc(dt, 0)
    const h = Math.hypot(this.vel.x, this.vel.z)
    out.speed = h
    out.moving = Math.min(1, h / T.swim)
    if (exhausted) return this.clip('exhausted')
    if (h > 3.6) {
      this.phase += dt * 1.25
      return this.clip('swim-sprint', 0.3)
    }
    if (h > 0.6 || Math.abs(this.vel.y) > 0.8) {
      this.phase += dt * (0.45 + Math.max(h, Math.abs(this.vel.y)) * 0.12)
      return this.clip('swim', 0.3)
    }
    this.phase += dt * 0.14
    return this.clip('swim', 0.6)
  }

  private steerHorizontal(dt: number, speed: number, accel: number, turn: number): void {
    const len = this.wish.length()
    const tx = len < 1e-4 ? 0 : (this.wish.x / len) * speed
    const tz = len < 1e-4 ? 0 : (this.wish.z / len) * speed
    const a = Math.min(1, accel * dt)
    this.vel.x += (tx - this.vel.x) * a
    this.vel.z += (tz - this.vel.z) * a
    if (speed > 0.05 && len > 1e-4) this.yaw += angleDiff(this.yaw, yawOf(this.wish.x, this.wish.z)) * Math.min(1, turn * dt)
  }

  private groundSteer(dt: number, target: number): void {
    const hx = this.vel.x
    const hz = this.vel.z
    const cur = Math.hypot(hx, hz)
    const len = this.wish.length()
    if (this.skidT > 0) {
      const ns = Math.max(0, cur - 22 * dt)
      if (cur > 1e-4) {
        this.vel.x = (hx / cur) * ns
        this.vel.z = (hz / cur) * ns
      }
      if (ns < 0.4 && len > 1e-4) this.yaw = yawOf(this.wish.x, this.wish.z)
      return
    }
    if (target < 0.05 || len < 1e-4) {
      const ns = Math.max(0, cur - 16 * dt)
      if (cur > 1e-4) {
        this.vel.x = (hx / cur) * ns
        this.vel.z = (hz / cur) * ns
      }
      return
    }
    const want = yawOf(this.wish.x, this.wish.z)
    let dirYaw = cur > 0.3 ? yawOf(hx, hz) : want
    const d = angleDiff(dirYaw, want)
    if (cur > 3.2 && Math.abs(d) > 2.5) {
      this.skidT = 0.26
      return
    }
    const turnRate = cur > 4.5 ? 7 : 11
    dirYaw += THREE.MathUtils.clamp(d, -turnRate * dt, turnRate * dt)
    const accel = target > cur ? (cur < 1 ? 22 : 13) : 18
    const ns = cur + THREE.MathUtils.clamp(target - cur, -accel * dt, accel * dt)
    this.vel.x = Math.sin(dirYaw) * ns
    this.vel.z = -Math.cos(dirYaw) * ns
    this.yaw += angleDiff(this.yaw, cur > 0.3 ? dirYaw : want) * Math.min(1, 16 * dt)
  }

  private clip(id: ClipId, fade = 0.22): void {
    this.out.clip = id
    this.out.clipFade = fade
  }

  private castFwd(origin: Vec3, dir: Vec3, reach: number) {
    return this.ctx.physics.raycast(origin, dir, reach, { excludeKinds: [...IGNORE] })
  }

  private wallAhead(reach = 0.7, moving = false): boolean {
    const dir = moving && this.wish.lengthSq() > 0.01 ? this.tmp2.copy(this.wish).normalize() : forward(this.yaw, this.tmp2)
    const hit = this.castFwd({ x: this.pos.x, y: this.pos.y + CHEST, z: this.pos.z }, dir, CAP_R + reach)
    this.wallTag = hit?.tag
    if (!hit) return false
    if (hit.tag && !hit.tag.climbable) return false
    if (Math.abs(hit.normal.y) > 0.62) return false
    this.climbN.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
    return true
  }

  private blockedAhead(): boolean {
    if (this.wish.lengthSq() < 0.01) return false
    const dir = this.tmp2.copy(this.wish).normalize()
    for (const h of [0.35, CHEST]) {
      if (this.castFwd({ x: this.pos.x, y: this.pos.y + h, z: this.pos.z }, dir, CAP_R + 0.4)) return true
    }
    return false
  }

  private findWall(useYaw: boolean): boolean {
    const dir = useYaw ? forward(this.yaw, this.tmp2) : this.tmp2.copy(this.climbN).negate()
    const hit = this.castFwd({ x: this.pos.x, y: this.pos.y + CHEST, z: this.pos.z }, dir, 1.2)
    if (!hit || (hit.tag && !hit.tag.climbable) || hit.normal.y > 0.8) return false
    this.climbN.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
    this.wallTag = hit.tag
    return true
  }

  private findLedge(n: THREE.Vector3, maxUp: number): number | null {
    const probe = { x: this.pos.x - n.x * 0.55, y: this.pos.y + maxUp + 0.4, z: this.pos.z - n.z * 0.55 }
    const top = this.ctx.physics.raycast(probe, { x: 0, y: -1, z: 0 }, maxUp + 0.4, { excludeKinds: [...IGNORE] })
    if (!top || top.normal.y < 0.6) return null
    const h = top.point.y - this.pos.y
    if (h < 0.25 || h > maxUp) return null
    const head = this.ctx.physics.raycast({ x: top.point.x, y: top.point.y + 0.05, z: top.point.z }, { x: 0, y: 1, z: 0 }, 1.5, { excludeKinds: [...IGNORE] })
    if (head) return null
    this.ledge.set(top.point.x, top.point.y + 0.02, top.point.z)
    return h
  }

  private startClimb(): void {
    if (this.carrying) return
    this.vel.set(0, 0, 0)
    this.yaw = yawOf(-this.climbN.x, -this.climbN.z)
    this.climbing = true
    this.gliding = false
    this.slipT = 0
    this.publish('climb')
  }

  private letGo(push = 1): void {
    this.climbing = false
    this.vel.copy(this.climbN).multiplyScalar(push)
    this.vel.y = Math.min(this.vel.y, 0)
    this.apexY = this.pos.y
    this.publish(this.medium === 'air' ? 'fall' : 'swim')
  }

  private updateClimb(dt: number, locked: boolean): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    out.style = 'climb'
    const water = this.medium === 'water'
    const strong = water && this.flow.length() > 4
    const n = this.climbN
    const right = this.tmp.set(n.z, 0, -n.x)
    if (right.lengthSq() < 1e-4) right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw))
    right.normalize()
    const up = this.climbUp.crossVectors(n, right).normalize()
    const mx = locked ? 0 : input.move.x
    let my = locked ? 0 : input.move.y
    const moving = Math.hypot(mx, my) > 0.1
    const wet = isWet(this.wallTag)
    const speed = water ? T.hullClimb : T.climbSpeed
    const cost = (moving ? (water ? T.hullClimbCost : T.climbCostMoving) : T.climbCostHanging) * (strong ? MOVE.strongCurrentClimbMul : 1) * (wet ? 1.6 : 1)

    if (ctx.state.hero.exhausted || !this.drain(cost, dt)) {
      this.letGo(0.6)
      return
    }
    if (!locked && input.pressed('down')) {
      this.letGo(1.2)
      return
    }
    const head = ctx.physics.raycast({ x: this.pos.x, y: this.pos.y + 1.6, z: this.pos.z }, { x: 0, y: 1, z: 0 }, 0.35, { excludeKinds: [...IGNORE] })
    if (head && my > 0) my = 0
    const delta = this.climbDelta.set(0, 0, 0)
    if (this.slipping > 0) {
      this.slipping -= dt
      delta.copy(up).multiplyScalar(-1.5 * dt)
    } else if (this.climbJumpT < 0.35) {
      delta.copy(this.climbJumpDir).multiplyScalar((T.climbJump / 0.35) * dt)
    } else if (!locked && input.pressed('up') && !wet && this.spend(T.climbJumpCost)) {
      this.climbJumpT = 0
      this.climbJumpDir.copy(up).multiplyScalar(my >= -0.2 ? Math.max(0.5, my) : my).addScaledVector(right, mx)
      if (this.climbJumpDir.lengthSq() < 0.01) this.climbJumpDir.copy(up)
      this.climbJumpDir.normalize()
    } else {
      delta.copy(right).multiplyScalar(mx).addScaledVector(up, my * (wet && my > 0 ? 0.55 : 1))
      if (delta.lengthSq() > 1) delta.normalize()
      delta.multiplyScalar(speed * dt)
      if (wet && my > 0.1) {
        this.slipT += dt
        if (this.slipT > 1.3) {
          this.slipT = 0
          this.slipping = 0.4
        }
      }
    }
    if (strong) delta.y -= 0.3 * dt
    if (moving || this.climbJumpT < 0.35) this.phase += (Math.max(Math.hypot(mx, my), 0.6) * speed * dt) / 0.9

    const origin = { x: this.pos.x + delta.x, y: this.pos.y + CHEST + delta.y, z: this.pos.z + delta.z }
    const hit = ctx.physics.raycast(origin, { x: -n.x, y: -n.y, z: -n.z }, 1.3, { excludeKinds: [...IGNORE] })
    if (!hit || hit.normal.y > 0.8) {
      if (my > 0.1 || this.climbJumpT < 0.35 || (hit && hit.normal.y > 0.8)) {
        this.mantle(n)
        return
      }
      this.letGo(0.3)
      return
    }
    if (hit.tag && !hit.tag.climbable) {
      this.letGo(0.4)
      return
    }
    this.wallTag = hit.tag
    n.lerp(this.tmp2.set(hit.normal.x, hit.normal.y, hit.normal.z), Math.min(1, dt * 10)).normalize()
    const gap = hit.distance - (CAP_R + 0.05)
    delta.addScaledVector(n, -gap)
    this.freeKcc()
    this.moveRaw(delta)
    if (this.grounded && my < -0.3 && n.y < 0.5 && !water) {
      this.climbing = false
      this.publish('idle')
      return
    }
    this.yaw = yawOf(-n.x, -n.z)
    this.publish('climb')
    out.pitch = -Math.asin(THREE.MathUtils.clamp(n.y, -0.9, 0.9)) * 0.8
    out.speed = moving ? speed : 0
    out.moving = 0
    if (this.slipping > 0) this.clip('climb-slip', 0.06)
    else if (this.climbJumpT < 0.4) this.clip('climb-jump', 0.08)
    else this.clip(moving ? 'climb' : 'climb-idle', 0.18)
  }

  private mantle(n: THREE.Vector3): void {
    if (this.findLedge(n, 2.4) !== null) {
      this.beginMantle()
      return
    }
    this.climbing = false
    this.vel.set(-n.x * 1.8, 3.2, -n.z * 1.8)
    this.apexY = this.pos.y
    this.publish(this.medium === 'air' ? 'fall' : 'swim')
  }

  private beginMantle(): void {
    this.climbing = false
    this.mantleFrom.copy(this.pos)
    this.mantleTo.copy(this.ledge)
    this.mantleT = 0
    this.vel.set(0, 0, 0)
    this.publish('climb')
  }

  private updateMantle(dt: number): void {
    const h = Math.max(0.3, this.mantleTo.y - this.mantleFrom.y)
    this.mantleT += dt / (0.3 + h * 0.18)
    const k = Math.min(1, this.mantleT)
    const up = Math.min(1, k / 0.6)
    const fwd = Math.max(0, (k - 0.35) / 0.65)
    const s = fwd * fwd * (3 - 2 * fwd)
    this.pos.set(
      THREE.MathUtils.lerp(this.mantleFrom.x, this.mantleTo.x, s),
      THREE.MathUtils.lerp(this.mantleFrom.y, this.mantleTo.y, Math.sin((up * Math.PI) / 2)),
      THREE.MathUtils.lerp(this.mantleFrom.z, this.mantleTo.z, s),
    )
    this.out.style = 'climb'
    this.out.speed = 0
    this.out.moving = 0
    this.clip(h < 1.1 ? 'jump' : 'climb-jump', 0.1)
    if (k >= 1) {
      this.mantleT = -1
      this.grounded = true
      this.wasGrounded = true
      this.landT = 0.15
      this.apexY = this.pos.y
      this.publish('idle')
    }
  }

  private poseScrub(dt: number): void {
    const drift = this.ctx.services.drift
    const chest = this.tmp.set(this.pos.x, this.pos.y + CHEST, this.pos.z)
    const w = drift?.nearestWindow(chest, 2.8)
    this.out.scrubbing = true
    this.out.speed = 0
    this.out.moving = 0
    this.publish('scrub')
    if (w) {
      const n = this.tmp2.set(w.normal.x, w.normal.y, w.normal.z).normalize()
      this.yaw += angleDiff(this.yaw, yawOf(-n.x, -n.z)) * Math.min(1, dt * 8)
      if (this.medium === 'water') {
        const want = this.tmp3.set(w.position.x, w.position.y - CHEST + 0.1, w.position.z).addScaledVector(n, 0.75)
        const toWant = want.sub(this.pos)
        this.vel.copy(toWant).multiplyScalar(2.5)
        this.freeKcc()
        this.moveRaw(this.tmp.copy(toWant).multiplyScalar(Math.min(1, dt * 2.5)))
        this.applyTether(dt)
      }
    }
    this.clip('scrub', 0.25)
  }

  private updateAir(dt: number, wishLen: number, locked: boolean): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    if (this.scrubPose) {
      this.poseScrub(dt)
      return
    }
    if (this.climbing) {
      this.updateClimb(dt, locked)
      return
    }
    const exhausted = ctx.state.hero.exhausted
    if (!locked && input.pressed('up')) this.jumpBuffer = T.buffer
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt)
    this.coyote = this.grounded ? T.coyote : Math.max(0, this.coyote - dt)
    let sprint = false

    if (this.grounded) {
      this.gliding = false
      this.apexY = this.pos.y
      if (wishLen > 0.3 && this.tryLadder()) return
      if (this.trySlideEntry()) return
      if (wishLen > 0.3 && !this.carrying && this.tryWall(dt)) return
      let target = wishLen < 0.6 ? INDOOR.walk * (wishLen / 0.6) : THREE.MathUtils.lerp(INDOOR.walk, INDOOR.run, (wishLen - 0.6) / 0.4)
      sprint = !locked && input.down('sprint') && wishLen > 0.3 && !exhausted && !this.carrying
      if (sprint && this.drain(T.sprintCost, dt)) target = T.sprint * wishLen
      else sprint = false
      if (this.carrying) target *= 0.7
      if (exhausted) target = Math.min(target, INDOOR.walk * 0.8)
      if (wishLen > 0.05) {
        const gh = this.tmp3.set(this.gravity.x, 0, this.gravity.z)
        const along = gh.dot(this.tmp2.copy(this.wish).normalize())
        target *= 1 + THREE.MathUtils.clamp((along / 9.81) * 2.5, -0.3, 0.3)
      }
      this.groundSteer(dt, target)
      this.vel.y = 0
      if (this.jumpBuffer > 0 && this.coyote > 0 && !exhausted) this.jump()
    } else {
      if (this.jumpBuffer > 0 && this.coyote > 0 && this.vel.y <= 0.5 && !exhausted) this.jump()
      else if (!locked && input.pressed('up') && !this.gliding && this.airT > 0.15 && this.vel.y < 0 && !this.carrying && this.hasItem('toile', false) && this.canAct()) this.gliding = true
      else if (this.gliding && !locked && (input.pressed('up') || input.pressed('down'))) this.gliding = false
      if (this.gliding) this.updateGlide(dt)
      else {
        const held = !locked && input.down('up')
        const gMul = this.vel.y > 0 ? (held || this.jumpT > 0.6 ? T.riseGravity : T.cutGravity) : T.fallGravity
        this.vel.addScaledVector(this.gravity, dt * gMul)
        const h = Math.hypot(this.vel.x, this.vel.z)
        const len = this.wish.length()
        if (len > 1e-4) {
          const cap = Math.max(h, INDOOR.run * 0.7)
          this.vel.x += ((this.wish.x / len) * cap * wishLen - this.vel.x) * Math.min(1, dt * 2.5)
          this.vel.z += ((this.wish.z / len) * cap * wishLen - this.vel.z) * Math.min(1, dt * 2.5)
          this.yaw += angleDiff(this.yaw, yawOf(this.wish.x, this.wish.z)) * Math.min(1, dt * 5)
        }
        this.vel.y = Math.max(this.vel.y, -22)
      }
      this.apexY = Math.max(this.apexY, this.pos.y)
      if (this.tryZipCatch(!locked && input.down('up'))) return
      if (!this.carrying && wishLen > 0.2 && this.tryAirGrab()) return
    }
    const prevY = this.pos.y
    this.moveKcc(dt, this.vel.y > 0.1 ? 0 : INDOOR.stepHeight)
    this.vyF += ((this.pos.y - prevY) / Math.max(dt, 1e-4) - this.vyF) * Math.min(1, dt * 5)
    const h = Math.hypot(this.vel.x, this.vel.z)
    out.speed = h
    out.moving = Math.min(1, h / INDOOR.walk)
    out.sprinting = sprint
    if (this.activity.kind !== 'none') return
    if (!this.grounded) {
      this.airT += dt
      if (this.gliding) {
        out.style = 'glide'
        this.publish('fall')
        return this.clip('glide', 0.25)
      }
      if (this.jumpT < 0.5 && this.vel.y > -1.5) {
        this.publish('jump')
        return this.clip('jump', 0.08)
      }
      this.publish('fall')
      if (this.airT > 0.25 || this.vel.y < -3) return this.clip('fall', 0.2)
      return
    }
    this.airT = 0
    if (exhausted) this.publish('exhausted')
    else if (this.carrying) this.publish('carry')
    else this.publish(h > INDOOR.walk * 1.2 ? 'run' : h > 0.05 ? 'walk' : this.landT < 0.3 ? 'land' : 'idle')
    if (this.skidT > 0) return this.clip('skid', 0.08)
    if (this.landT < 0.3) return this.clip('land-dry', 0.06)
    if (this.shakeT < 1.3) return this.clip('shake-off', 0.15)
    if (this.hatchT < INDOOR.hatchSpinSeconds) return this.clip('open-hatch', 0.15)
    if (h > 0.25) {
      const kind = sprint && h > 4.4 ? 'sprint' : h > 2.6 ? 'run' : 'walk'
      this.phase += (h * dt) / (kind === 'sprint' ? 2.7 : kind === 'run' ? 2.1 : 1.15)
      this.stepCheck()
      if (this.carrying) return this.clip('carry-walk', 0.2)
      if (kind === 'sprint') return this.clip('sprint', 0.2)
      const dy = this.vyF
      if (this.groundKind === 'stair' && Math.abs(dy) > 0.12 && kind === 'walk') return this.clip(dy > 0 ? 'stairs-up' : 'stairs-down', 0.2)
      return this.clip(kind === 'run' ? 'run-dry' : 'walk-dry', 0.2)
    }
    if (this.carrying) return this.clip('carry-idle', 0.3)
    return this.clip(this.talking ? 'talk' : exhausted ? 'exhausted' : 'idle-dry', 0.3)
  }

  private jump(): void {
    const g = this.gravity.length() * T.riseGravity
    const hgt = this.carrying ? T.carryJump : T.jumpHeight
    this.vel.y = Math.sqrt(2 * g * hgt)
    const h = Math.hypot(this.vel.x, this.vel.z)
    if (h > INDOOR.run) this.vel.y *= 1.06
    this.grounded = false
    this.coyote = 0
    this.jumpBuffer = 0
    this.jumpT = 0
    this.skidT = 0
    this.apexY = this.pos.y
  }

  private updateGlide(dt: number): void {
    if (!this.drain(T.toileCost, dt) || this.ctx.state.hero.exhausted) {
      this.gliding = false
      return
    }
    const len = this.wish.length()
    if (len > 1e-4) this.yaw += angleDiff(this.yaw, yawOf(this.wish.x, this.wish.z)) * Math.min(1, dt * 2)
    const f = forward(this.yaw, this.tmp3)
    this.vel.x += (f.x * T.toileForward - this.vel.x) * Math.min(1, dt * 2)
    this.vel.z += (f.z * T.toileForward - this.vel.z) * Math.min(1, dt * 2)
    const drift = this.ctx.services.drift as unknown as { updraftAt?: (l: Vec3) => number } | undefined
    const lift = drift?.updraftAt?.(this.localNow()) ?? 0
    this.vel.y += (lift - T.toileFall - this.vel.y) * Math.min(1, dt * 3)
    this.apexY = this.pos.y
  }

  private tryWall(dt: number): boolean {
    if (!this.wallAhead(0.45, true)) {
      this.pushT = 0
      return false
    }
    this.pushT += dt
    const ledgeH = this.findLedge(this.climbN, 1.5)
    const jumpy = this.jumpBuffer > 0
    if (ledgeH !== null && (jumpy || (ledgeH <= 1.05 && this.pushT > 0.3))) {
      this.jumpBuffer = 0
      this.beginMantle()
      return true
    }
    if (isWet(this.wallTag) || !this.canAct()) return false
    const easy = EASY_CLIMB.has(this.wallTag?.kind ?? 'wall')
    if ((easy && this.pushT > 0.3) || jumpy) {
      this.jumpBuffer = 0
      this.startClimb()
      return true
    }
    return false
  }

  private tryAirGrab(): boolean {
    if (!this.wallAhead(0.35, true)) return false
    if (this.findLedge(this.climbN, 1.6) !== null && this.vel.y < 2) {
      this.beginMantle()
      return true
    }
    if (isWet(this.wallTag) || !this.canAct()) return false
    this.startClimb()
    return true
  }

  private tryLadder(): boolean {
    const local = this.localNow()
    const facing = forward(this.yaw, this.tmp2)
    for (const a of this.anchors.near(local, 2.5, this.near)) {
      if (a.kind !== 'ladder') continue
      const b = this.toW(a.bottom, this.tmp)
      const nb = Math.hypot(this.pos.x - b.x, this.pos.z - b.z)
      const nW = this.ladderNormalW(a, this.tmp3)
      const into = -(facing.x * nW.x + facing.z * nW.z)
      if (nb < 0.75 && Math.abs(this.pos.y - b.y) < 0.6 && into > 0.5) {
        this.attachLadder(a)
        return true
      }
      const tp = this.toW(a.top, this.tmp)
      const nt = Math.hypot(this.pos.x - tp.x, this.pos.z - tp.z)
      if (nt < 0.65 && Math.abs(this.pos.y - tp.y) < 0.6 && into < -0.5) {
        this.attachLadder(a, 0.97)
        return true
      }
    }
    return false
  }

  private ladderNormalW(a: LadderA, out: THREE.Vector3): THREE.Vector3 {
    const h = this.ctx.services.drift?.pose().heading ?? 0
    return out.set(a.normal.x, a.normal.y, a.normal.z).applyAxisAngle(UP, -h).normalize()
  }

  private grabLadder(id: string | null): void {
    if (this.activity.kind === 'ladder') return
    const local = this.localNow()
    let best: LadderA | null = null
    let bd = 3
    for (const a of this.anchors.near(local, 3, this.near)) {
      if (a.kind !== 'ladder') continue
      if (id && a.id === id) {
        best = a
        break
      }
      const d = Math.min(
        Math.hypot(local.x - a.bottom.x, local.y - a.bottom.y, local.z - a.bottom.z),
        Math.hypot(local.x - a.top.x, local.y - a.top.y, local.z - a.top.z),
      )
      if (d < bd) {
        bd = d
        best = a
      }
    }
    if (!best) return
    const fromTop = Math.abs(local.y - best.top.y) < Math.abs(local.y - best.bottom.y)
    this.attachLadder(best, fromTop ? 0.97 : undefined)
  }

  private attachLadder(a: LadderA, s?: number): void {
    const len = Math.max(0.1, a.top.y - a.bottom.y)
    const local = this.localNow()
    const start = s ?? THREE.MathUtils.clamp((local.y - a.bottom.y) / len, 0, 1)
    this.activity = { kind: 'ladder', a, s: Math.min(start, 0.98), topT: -1, mountT: s !== undefined && s > 0.9 ? 0.5 : 0 }
    this.vel.set(0, 0, 0)
    this.climbing = false
    this.gliding = false
    this.publish('ladder')
  }

  private updateLadder(dt: number, a: Extract<Activity, { kind: 'ladder' }>, locked: boolean): boolean {
    const input = this.ctx.input
    const bottom = this.toW(a.a.bottom, this.tmp)
    const top = this.toW(a.a.top, this.tmp2)
    const n = this.ladderNormalW(a.a, this.tmp3)
    const len = Math.max(0.1, bottom.distanceTo(top))
    this.yaw = yawOf(-n.x, -n.z)
    this.out.speed = 0
    this.out.moving = 0
    this.out.style = 'ladder'
    if (a.topT >= 0) {
      a.topT += dt
      const k = Math.min(1, a.topT / 0.9)
      const from = top.clone().addScaledVector(n, 0.35)
      const over = top.clone().addScaledVector(n, -0.55)
      this.pos.lerpVectors(from, over, k * k)
      this.pos.y = top.y + Math.sin(k * Math.PI) * 0.15
      this.clip('ladder-top', 0.1)
      if (k >= 1) {
        this.activity = { kind: 'none' }
        this.apexY = this.pos.y
        this.publish('idle')
      }
      this.syncLocal()
      return true
    }
    let my = locked ? 0 : input.move.y
    if (a.mountT > 0) {
      a.mountT -= dt
      my = -0.6
    }
    if (!locked && input.pressed('down')) {
      this.activity = { kind: 'none' }
      this.vel.copy(n).multiplyScalar(0.8)
      this.apexY = this.pos.y
      this.publish('fall')
      return true
    }
    if (!locked && input.pressed('up') && a.s < 0.97) {
      this.activity = { kind: 'none' }
      this.vel.copy(n).multiplyScalar(2.6)
      this.vel.y = 3.4
      this.yaw = yawOf(n.x, n.z)
      this.jumpT = 0
      this.apexY = this.pos.y
      this.publish('jump')
      return true
    }
    const sprint = !locked && input.down('sprint')
    const sliding = sprint && my < -0.3
    const speed = sliding ? T.ladderSlide : sprint ? T.ladderFast : T.ladder
    a.s += ((sliding ? -1 : my) * speed * dt) / len
    this.phase += (Math.abs(sliding ? 0 : my) * speed * dt) / 0.7
    if (a.s >= 1) {
      a.s = 1
      if (my > 0.2 || (!locked && input.pressed('up'))) a.topT = 0
    }
    if (a.s <= 0) {
      a.s = 0
      if (my < -0.2 || sliding) {
        this.activity = { kind: 'none' }
        if (sliding) this.landT = 0
        this.publish('idle')
        return true
      }
    }
    this.pos.lerpVectors(bottom, top, a.s).addScaledVector(n, 0.35)
    this.syncLocal()
    this.publish('ladder')
    this.clip(sliding ? 'ladder-slide' : 'ladder', sliding ? 0.08 : 0.2)
    return true
  }

  private tryZipCatch(holdingUp: boolean): boolean {
    if (!this.hasItem('poulie', true)) return false
    const hand = this.tmp3.set(this.pos.x, this.pos.y + T.zipHang, this.pos.z)
    const drift = this.ctx.services.drift
    const local = drift ? drift.toLocal(hand) : { x: hand.x, y: hand.y, z: hand.z }
    for (const a of this.anchors.near(local, T.zipReach + (holdingUp ? 0.3 : 0), this.near)) {
      if (a.kind !== 'zip') continue
      const t = closestOnSegment(local, a.from, a.to, this.tmp)
      if (t <= 0.02 || t >= 0.98) continue
      this.startZip(a, t)
      return true
    }
    return false
  }

  private startZip(a: ZipA, s: number): void {
    const A = this.toW(a.from, this.tmp)
    const B = this.toW(a.to, this.tmp2)
    const u = this.tmp3.subVectors(B, A).normalize()
    let dir: 1 | -1
    if (Math.abs(B.y - A.y) > 0.4) dir = B.y < A.y ? 1 : -1
    else {
      const f = this.vel.lengthSq() > 0.25 ? this.vel : forward(this.yaw, new THREE.Vector3())
      dir = f.x * u.x + f.z * u.z >= 0 ? 1 : -1
    }
    const v = Math.max(1.5, (this.vel.x * u.x + this.vel.y * u.y + this.vel.z * u.z) * dir)
    this.activity = { kind: 'zip', a, s, v: Math.min(v, T.zipMax), dir, swing: 0.35, swingV: 0, lastV: v }
    this.climbing = false
    this.gliding = false
    this.vel.set(0, 0, 0)
    this.publish('zip')
  }

  private updateZip(dt: number, z: Extract<Activity, { kind: 'zip' }>, locked: boolean): boolean {
    const input = this.ctx.input
    const A = this.toW(z.a.from, this.tmp)
    const B = this.toW(z.a.to, this.tmp2)
    const L = Math.max(0.5, A.distanceTo(B))
    const u = this.tmp3.subVectors(B, A).divideScalar(L).multiplyScalar(z.dir)
    const gAlong = this.gravity.dot(u)
    z.v += (gAlong * 0.92 - 0.012 * z.v * z.v - 0.25) * dt
    if (!locked && input.move.y > 0.2 && z.v < 2.2) z.v += 2.5 * dt
    z.v = THREE.MathUtils.clamp(z.v, 0, T.zipMax)
    const accel = (z.v - z.lastV) / Math.max(dt, 1e-4)
    z.lastV = z.v
    z.swingV += (-z.swing * 9.81 / 1.6 - accel * 0.25 - z.swingV * 1.2) * dt
    z.swing = THREE.MathUtils.clamp(z.swing + z.swingV * dt, -0.7, 0.7)
    z.s += (z.dir * z.v * dt) / L
    this.out.style = 'zip'
    this.out.zipping = true
    this.out.swing = z.swing
    this.out.speed = z.v
    this.out.moving = Math.min(1, z.v / 4)
    const drop = (vy: number) => {
      this.activity = { kind: 'none' }
      this.vel.copy(u).multiplyScalar(z.v)
      this.vel.y += vy
      this.jumpT = vy > 1 ? 0 : 99
      this.apexY = this.pos.y
      this.airT = 0.2
      this.publish(vy > 1 ? 'jump' : 'fall')
    }
    if (!this.drain(T.zipCost, dt) || this.ctx.state.hero.exhausted) {
      drop(0)
      return true
    }
    if (!locked && input.pressed('down')) {
      drop(0)
      return true
    }
    if (!locked && input.pressed('up')) {
      drop(3.6)
      return true
    }
    if (z.s <= 0 || z.s >= 1) {
      z.s = THREE.MathUtils.clamp(z.s, 0, 1)
      drop(1.2)
      return true
    }
    const hand = this.tmp2.copy(A).lerp(this.toW(z.a.to, new THREE.Vector3()), z.s)
    const lat = new THREE.Vector3().crossVectors(UP, u).normalize()
    const body = new THREE.Vector3(0, 1, 0).applyAxisAngle(lat, z.swing)
    this.pos.copy(hand).addScaledVector(body, -T.zipHang)
    this.yaw = yawOf(u.x, u.z)
    this.leanGoal.copy(lat).multiplyScalar(z.swing)
    this.syncLocal()
    this.publish('zip')
    this.clip('zip', 0.12)
    return true
  }

  private trySlideEntry(): boolean {
    const local = this.localNow()
    for (const a of this.anchors.near(local, 1.5, this.near)) {
      if (a.kind !== 'slide' || a.path.length < 2) continue
      const p0 = a.path[0]!
      const p1 = a.path[1]!
      if (Math.hypot(local.x - p0.x, local.z - p0.z) > 0.8 || Math.abs(local.y - p0.y) > 0.7) continue
      const dx = p1.x - p0.x
      const dz = p1.z - p0.z
      const dl = Math.hypot(dx, dz) || 1
      const drift = this.ctx.services.drift
      const lv = drift ? this.tmp.copy(this.vel).applyAxisAngle(UP, drift.pose().heading) : this.tmp.copy(this.vel)
      if ((lv.x * dx + lv.z * dz) / dl < 0.8) continue
      this.startSlide(a)
      return true
    }
    return false
  }

  private startSlide(a: SlideA): void {
    const cum = [0]
    for (let i = 1; i < a.path.length; i++) {
      const p = a.path[i - 1]!
      const q = a.path[i]!
      cum.push(cum[i - 1]! + Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z))
    }
    const v = Math.max(T.slideMin, Math.hypot(this.vel.x, this.vel.z))
    this.activity = { kind: 'slide', a, cum, d: 0, v, off: 0, lastYaw: this.yaw }
    this.climbing = false
    this.gliding = false
    this.vel.set(0, 0, 0)
    this.publish('slide')
  }

  private updateSlide(dt: number, sl: Extract<Activity, { kind: 'slide' }>, locked: boolean): boolean {
    const input = this.ctx.input
    const path = sl.a.path
    const total = sl.cum[sl.cum.length - 1]!
    let i = 0
    while (i < sl.cum.length - 2 && sl.cum[i + 1]! < sl.d) i++
    const p = this.toW(path[i]!, this.tmp)
    const q = this.toW(path[i + 1]!, this.tmp2)
    const segLen = Math.max(1e-3, sl.cum[i + 1]! - sl.cum[i]!)
    const k = THREE.MathUtils.clamp((sl.d - sl.cum[i]!) / segLen, 0, 1)
    const u = this.tmp3.subVectors(q, p).normalize()
    const gAlong = this.gravity.dot(u)
    sl.v += (gAlong * 0.95 - 0.015 * sl.v * sl.v) * dt
    sl.v = THREE.MathUtils.clamp(sl.v, T.slideMin, T.slideMax)
    sl.d += sl.v * dt
    const mx = locked ? 0 : this.ctx.input.move.x
    sl.off = THREE.MathUtils.clamp(sl.off + mx * dt * 1.4, -0.3, 0.3)
    const lat = new THREE.Vector3().crossVectors(u, UP).normalize()
    this.pos.copy(p).lerp(q, k).addScaledVector(lat, sl.off)
    const yaw = yawOf(u.x, u.z)
    const turn = angleDiff(sl.lastYaw, yaw) / Math.max(dt, 1e-4)
    sl.lastYaw = yaw
    this.yaw = yaw
    this.out.bank += (THREE.MathUtils.clamp(-turn * 0.35 * (sl.v / 6), -0.8, 0.8) - this.out.bank) * Math.min(1, dt * 6)
    this.out.style = 'slide'
    this.out.speed = sl.v
    this.out.moving = 1
    this.out.pitch = Math.asin(THREE.MathUtils.clamp(u.y, -1, 1))
    this.leanGoal.copy(lat).multiplyScalar(-Math.asin(THREE.MathUtils.clamp(u.y, -0.6, 0.6)))
    const leave = (vy: number) => {
      this.activity = { kind: 'none' }
      this.vel.copy(u).multiplyScalar(sl.v)
      this.vel.y = Math.max(this.vel.y, 0) + vy
      this.jumpT = vy > 1 ? 0 : 99
      this.apexY = this.pos.y
      this.grounded = false
      this.publish(vy > 1 ? 'jump' : 'fall')
    }
    if (!locked && input.pressed('up')) {
      leave(4)
      return true
    }
    if (sl.d >= total) {
      leave(0.5)
      return true
    }
    this.syncLocal()
    this.publish('slide')
    this.clip('slide', 0.12)
    return true
  }

  private startSleep(): void {
    const local = this.localNow()
    let bed: Vec3 | null = null
    let bedYaw = this.yaw
    let bd = 3
    for (const a of this.anchors.near(local, 3, this.near)) {
      if (a.kind !== 'bed' && a.kind !== 'hammock') continue
      const d = Math.hypot(a.at.x - local.x, a.at.y - local.y, a.at.z - local.z)
      if (d < bd) {
        bd = d
        bed = a.at
        bedYaw = a.yaw
      }
    }
    this.activity = { kind: 'sleep', stage: 'down', t: 0, bed, bedYaw, from: this.pos.clone() }
    this.vel.set(0, 0, 0)
  }

  private updateActivity(dt: number, wishLen: number, locked: boolean): boolean {
    const a = this.activity
    const ctx = this.ctx
    const input = ctx.input
    const wantsUp = !locked && (wishLen > 0.35 || input.pressed('down'))
    switch (a.kind) {
      case 'ladder':
        return this.updateLadder(dt, a, locked)
      case 'zip':
        return this.updateZip(dt, a, locked)
      case 'slide':
        return this.updateSlide(dt, a, locked)
      case 'roll':
        return this.updateRoll(dt, a)
      case 'tube': {
        a.t += dt
        this.vel.set(0, 0, 0)
        this.out.speed = 0
        this.out.moving = 0
        this.out.freezeCamera = a.stage === 'in'
        this.clip(a.stage === 'in' ? 'tube-in' : 'tube-out', 0.1)
        if (a.stage === 'out' && a.t > 0.7) {
          this.activity = { kind: 'none' }
          this.publish('idle')
        }
        return true
      }
      case 'gesture': {
        a.t += dt
        this.vel.x *= 0.8
        this.vel.z *= 0.8
        this.out.speed = 0
        this.out.moving = 0
        if (this.medium === 'water') this.moveKcc(dt, 0)
        this.clip(a.clip, 0.2)
        if ((a.dur > 0 && a.t >= a.dur) || (a.dur <= 0 && wantsUp && a.t > 0.3)) this.activity = { kind: 'none' }
        return true
      }
      case 'sit':
        return this.updateSit(dt, a, wishLen, wantsUp)
      case 'lean': {
        a.t += dt
        const to = this.tmp.copy(a.target).sub(this.pos)
        this.yaw += angleDiff(this.yaw, yawOf(to.x, to.z)) * Math.min(1, dt * 8)
        this.vel.set(0, 0, 0)
        this.out.speed = 0
        this.out.moving = 0
        if (a.stage !== 'up') {
          this.publish('lean')
          this.clip('lean', 0.45)
          if (wantsUp) {
            a.stage = 'up'
            a.t = 0
          }
        } else {
          this.clip('idle-dry', 0.4)
          if (a.t > 0.4) {
            this.activity = { kind: 'none' }
            this.publish('idle')
          }
        }
        return true
      }
      case 'sleep': {
        a.t += dt
        this.vel.set(0, 0, 0)
        this.out.speed = 0
        this.out.moving = 0
        this.out.style = 'rest'
        this.publish('sleep')
        if (a.stage === 'down') {
          if (a.bed) {
            const k = Math.min(1, a.t)
            this.pos.lerpVectors(a.from, this.toW(a.bed, this.tmp), k * k * (3 - 2 * k))
            const heading = ctx.services.drift?.pose().heading ?? 0
            this.yaw += angleDiff(this.yaw, a.bedYaw + heading) * Math.min(1, dt * 6)
            this.syncLocal()
          }
          this.clip('lie-down', 0.2)
          if (a.t > 1) {
            a.stage = 'sleep'
            a.t = 0
          }
        } else if (a.stage === 'sleep') {
          this.clip('sleep', 0.4)
        } else {
          this.clip('wake', 0.1)
          if (a.t > 1) {
            if (a.bed) {
              this.pos.copy(a.from)
              this.syncLocal()
            }
            this.activity = { kind: 'none' }
            this.publish('idle')
          }
        }
        return true
      }
      default:
        return false
    }
  }

  private updateSit(dt: number, a: Extract<Activity, { kind: 'sit' }>, wishLen: number, wantsUp: boolean): boolean {
    a.t += dt
    this.out.style = 'rest'
    if (a.stage === 'approach') {
      const to = this.tmp.copy(a.anchor).sub(this.pos)
      to.y = 0
      const d = to.length()
      if (d < 0.5 || a.t > 3) {
        a.standAt.copy(this.pos)
        this.yaw = a.yaw
        a.stage = 'down'
        a.t = 0
        this.publish('sit')
        this.syncLocal()
      } else {
        this.wish.copy(to).normalize()
        this.steerHorizontal(dt, Math.min(INDOOR.walk, d * 3), 12, 12)
        this.vel.y = 0
        this.moveKcc(dt, INDOOR.stepHeight)
        this.phase += (Math.hypot(this.vel.x, this.vel.z) * dt) / 1.15
        this.stepCheck()
        this.publish('walk')
        this.clip('walk-dry')
        if (wantsUp && wishLen > 0.35) this.activity = { kind: 'none' }
      }
      return true
    }
    this.vel.set(0, 0, 0)
    this.out.speed = 0
    this.out.moving = 0
    this.yaw += angleDiff(this.yaw, a.yaw) * Math.min(1, dt * 10)
    const seatPos = this.tmp2.set(a.anchor.x, a.anchor.y - SEAT_DROP, a.anchor.z)
    if (a.stage === 'down') {
      const k = Math.min(1, a.t / 0.7)
      this.pos.lerpVectors(a.standAt, seatPos, k * k * (3 - 2 * k))
      this.syncLocal()
      this.clip('sit-down', 0.2)
      if (a.t > 0.7) {
        a.stage = 'sit'
        a.t = 0
      }
    } else if (a.stage === 'sit') {
      const h = this.ctx.state.time.hours
      const meal = this.room === 'refectoire' && ((h >= 7.5 && h < 8.5) || (h >= 19 && h < 21))
      this.clip(meal ? 'eat' : this.talking ? 'talk' : 'sit', 0.4)
      if (this.talking) this.clip('sit', 0.4)
      if (wantsUp && this.lock === null) {
        a.stage = 'up'
        a.t = 0
      }
    } else {
      const k = Math.min(1, a.t / 0.6)
      this.pos.lerpVectors(seatPos, a.standAt, k * k * (3 - 2 * k))
      this.syncLocal()
      this.clip('stand-up', 0.1)
      if (a.t > 0.6) {
        this.pos.copy(a.standAt)
        this.syncLocal()
        this.activity = { kind: 'none' }
        this.publish('idle')
      }
    }
    return true
  }

  private updateRoll(dt: number, r: Extract<Activity, { kind: 'roll' }>): boolean {
    r.t += dt
    const dur = r.hard ? 0.9 : 0.72
    const k = Math.min(1, r.t / dur)
    const sp = r.hard ? 0 : 3.6 * (1 - k)
    this.vel.set(r.dir.x * sp, 0, r.dir.z * sp)
    this.moveKcc(dt, INDOOR.stepHeight)
    if (!this.grounded) this.vel.y += this.gravity.y * dt
    this.out.speed = sp
    this.out.moving = 0
    this.publish('land')
    this.clip(r.hard ? 'land-hard' : 'roll', 0.05)
    if (k >= 1) {
      this.activity = { kind: 'none' }
      this.publish('idle')
    }
    return true
  }

  private onAirlock(dir: 'in' | 'out', phase: 'close' | 'pump' | 'open' | 'done'): void {
    if (phase === 'close') {
      this.airlock = { dir, phase, t: 0 }
      this.activity = { kind: 'none' }
      this.climbing = false
      this.lock = 'airlock'
      this.publish('airlock')
      return
    }
    if (!this.airlock) this.airlock = { dir, phase, t: 0 }
    this.airlock.phase = phase
    this.airlock.t = 0
    if (phase === 'pump' && dir === 'out') this.setMedium('water')
    if (phase === 'done') {
      this.setMedium(dir === 'in' ? 'air' : 'water')
      this.airlock = null
      this.lock = null
      this.publish(this.medium === 'air' ? 'idle' : 'swim')
    }
  }

  private updateAirlock(dt: number): void {
    const al = this.airlock
    this.out.speed = 0
    this.out.moving = 0
    this.out.style = 'rest'
    if (!al) {
      this.vel.x = this.vel.z = 0
      if (this.medium === 'air') {
        this.vel.y = this.grounded ? 0 : this.vel.y + this.gravity.y * dt
        this.moveKcc(dt, INDOOR.stepHeight)
      }
      this.clip(this.medium === 'air' ? 'idle-dry' : 'idle', 0.4)
      return
    }
    al.t += dt
    if (al.dir === 'in' && al.phase === 'pump' && this.medium === 'water' && al.t > 1.6) {
      this.setMedium('air')
      this.landT = 0
      this.shakeT = -0.35
    }
    if (this.medium === 'air') {
      this.vel.x = this.vel.z = 0
      this.vel.y = this.grounded ? 0 : this.vel.y + this.gravity.y * dt
      this.moveKcc(dt, INDOOR.stepHeight)
      if (this.landT < 0.35) this.clip('land-dry', 0.06)
      else if (this.shakeT < 1.3) this.clip('shake-off', 0.15)
      else this.clip('idle-dry', 0.3)
    } else {
      this.vel.set(0, al.dir === 'out' ? 0.15 : -0.3, 0)
      this.moveKcc(dt, 0)
      this.clip(this.grounded ? 'idle-floor' : 'idle', 0.4)
    }
  }

  private updateCutscene(dt: number): void {
    this.out.speed = 0
    this.out.moving = 0
    this.out.style = 'rest'
    this.vel.x *= Math.max(0, 1 - dt * 6)
    this.vel.z *= Math.max(0, 1 - dt * 6)
    if (this.medium === 'air') {
      this.vel.y = this.grounded ? 0 : this.vel.y + this.gravity.y * dt
      this.moveKcc(dt, INDOOR.stepHeight)
    } else this.vel.y *= Math.max(0, 1 - dt * 3)
    this.clip(this.talking ? 'talk' : this.medium === 'air' ? 'idle-dry' : 'idle', 0.4)
  }

  private filter = (c: RAPIER.Collider) => {
    const t = this.ctx.physics.tagOf(c.handle)
    return !t || !IGNORE.includes(t.kind)
  }

  private moveKcc(dt: number, step: number, currentMul = 1): void {
    const d = this.tmp.copy(this.vel).multiplyScalar(dt)
    if (this.medium === 'water') d.addScaledVector(this.flow, currentMul * dt)
    const air = this.medium === 'air'
    this.kcc.setMaxSlopeClimbAngle(air ? INDOOR.maxSlopeDeg * (Math.PI / 180) : WALK_WATER_SLOPE)
    this.kcc.setMinSlopeSlideAngle(air ? 55 * (Math.PI / 180) : 60 * (Math.PI / 180))
    if (step > 0) {
      this.kcc.enableAutostep(step, 0.15, false)
      this.kcc.enableSnapToGround(air ? 0.35 : 0.25)
    } else {
      this.kcc.disableAutostep()
      this.kcc.disableSnapToGround()
    }
    if (air && step > 0 && this.vel.y <= 0.1) this.liftOutOfFloor()
    const bx = this.pos.x
    const bz = this.pos.z
    this.moveRaw(d)
    if (this.medium === 'water') this.applyTether(dt)
    else if (this.hitWall && dt > 1e-4 && this.activity.kind === 'none' && !this.climbing) {
      const ax = (this.pos.x - bx) / dt
      const az = (this.pos.z - bz) / dt
      if (ax * ax + az * az < this.vel.x * this.vel.x + this.vel.z * this.vel.z) {
        this.vel.x = ax
        this.vel.z = az
      }
    }
  }

  private liftOutOfFloor(): void {
    const hit = this.ctx.physics.raycast({ x: this.pos.x, y: this.pos.y + 0.45, z: this.pos.z }, { x: 0, y: -1, z: 0 }, 0.5, { excludeKinds: [...IGNORE] })
    if (hit && hit.normal.y > 0.7 && hit.point.y > this.pos.y + 0.003) this.pos.y = hit.point.y + 0.01
  }

  private freeKcc(): void {
    this.kcc.disableAutostep()
    this.kcc.disableSnapToGround()
    this.kcc.setMaxSlopeClimbAngle(Math.PI / 2)
    this.kcc.setMinSlopeSlideAngle(Math.PI / 2)
  }

  private moveRaw(d: THREE.Vector3): void {
    const R = this.ctx.physics.rapier
    const c = this.collider
    let mx = d.x
    let my = d.y
    let mz = d.z
    const attempt = (lift: number) => {
      c.setTranslation({ x: this.pos.x, y: this.pos.y + CAP_CENTER + lift, z: this.pos.z })
      this.kcc.computeColliderMovement(c, { x: d.x, y: d.y - lift, z: d.z }, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.filter)
      const m = this.kcc.computedMovement()
      this.hitWall = false
      for (let i = this.kcc.numComputedCollisions() - 1; i >= 0; i--) {
        const k = this.kcc.computedCollision(i)
        if (k && Math.abs(k.normal1.y) < 0.5) {
          this.hitWall = true
          break
        }
      }
      mx = m.x
      my = m.y + lift
      mz = m.z
      this.grounded = this.kcc.computedGrounded() && !(this.vel.y > 0.5 && this.jumpT < 0.3)
    }
    try {
      attempt(0)
      const want = Math.hypot(d.x, d.z)
      // Rapier can stall a capsule resting exactly at its offset on a flat floor; a tiny lift frees it.
      if (want > 0.004 && Math.hypot(mx, mz) < want * 0.25 && !this.hitWall && this.medium === 'air') attempt(0.02)
    } catch {
      this.grounded = false
    }
    c.setTranslation(PARK)
    this.pos.x += mx
    this.pos.y += my
    this.pos.z += mz
    if (d.y > 0 && my < d.y * 0.5) this.vel.y = Math.min(this.vel.y, 0)
    if (this.medium === 'water') this.grounded = false
    if (this.lock !== 'cutscene' && this.pos.y > HERO_MAX_Y) {
      this.pos.y += (HERO_MAX_Y - this.pos.y) * 0.2
      this.vel.y = Math.min(this.vel.y, -0.5)
    }
    this.probeGround()
    if (this.grounded && !this.wasGrounded) this.onLand()
    this.fallSpeed = this.vel.y
    this.wasGrounded = this.grounded
  }

  private onLand(): void {
    const speed = Math.max(0, -this.fallSpeed)
    const drop = this.apexY - this.pos.y
    this.apexY = this.pos.y
    this.gliding = false
    this.ctx.bus.emit('hero:landed', { speed, kind: this.groundKind })
    if (this.medium !== 'air' || this.climbing || this.activity.kind !== 'none') return
    if (this.groundKind === 'net' && speed > 3) {
      this.vel.y = Math.min(9, speed * 0.55)
      this.grounded = false
      this.wasGrounded = false
      this.jumpT = 0
      return
    }
    const dir = this.tmp2.set(this.vel.x, 0, this.vel.z)
    if (dir.lengthSq() < 0.01) forward(this.yaw, dir)
    dir.normalize()
    if (drop > T.hardFall) {
      this.spend(T.hardCost)
      this.activity = { kind: 'roll', t: 0, dir: dir.clone(), hard: true }
    } else if (drop > T.rollFall) {
      this.spend(T.rollCost)
      this.activity = { kind: 'roll', t: 0, dir: dir.clone(), hard: false }
    } else if (speed > 3.5 || drop > 1.6) this.landT = drop > 2.5 ? 0 : 0.12
  }

  private probeGround(): void {
    if (!this.grounded) return
    const hit = this.ctx.physics.raycast({ x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z }, { x: 0, y: -1, z: 0 }, 0.7, { excludeKinds: [...IGNORE] })
    if (hit) {
      this.groundKind = hit.tag?.kind ?? 'floor'
      this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z)
    } else {
      this.groundKind = 'floor'
      this.groundNormal.set(0, 1, 0)
    }
  }

  private stepCheck(): void {
    const idx = Math.floor(this.phase * 2)
    if (idx === this.stepIdx) return
    this.stepIdx = idx
    this.ctx.bus.emit('hero:step', { surface: STEP_SURFACE[this.groundKind] ?? 'bois', wet: this.wetness > 0.1 })
    this.stepCb((idx & 1) === 0)
  }

  private npcLook(): THREE.Vector3 | null {
    if (!this.talking) return null
    const p = this.ctx.services.drift?.npcPosition(this.talking)
    return p ? v3(p) : null
  }

  private updateLean(dt: number): void {
    if (this.medium === 'air' && this.out.style === 'walk' && this.grounded && this.activity.kind === 'none') {
      const ax = (this.vel.x - this.prevVel.x) / Math.max(dt, 1e-4)
      const az = (this.vel.z - this.prevVel.z) / Math.max(dt, 1e-4)
      this.leanGoal.set(-az, 0, ax).multiplyScalar(0.012)
      const g = this.gravity
      this.leanGoal.x += -g.z / 9.81 * 0.6
      this.leanGoal.z += g.x / 9.81 * 0.6
      if (this.leanGoal.length() > 0.2) this.leanGoal.setLength(0.2)
    }
    const k = this.out.style === 'zip' || this.out.style === 'slide' ? 1 : Math.min(1, dt * 8)
    this.out.lean.lerp(this.leanGoal, k)
  }

  private housekeeping(dt: number): void {
    const ctx = this.ctx
    const s = ctx.state
    if (this.medium === 'water') this.wetness = 1
    else this.wetness = Math.max(0, this.wetness - dt / INDOOR.wetnessDrySeconds)

    const drift = ctx.services.drift
    if (!this.recovering && this.medium === 'water' && s.mode === 'inside' && this.lock !== 'airlock' && drift) {
      if (drift.cellAt(drift.toLocal(this.pos)) === null) this.recover()
    }
    const free = this.activity.kind === 'none' && !this.climbing && this.mantleT < 0 && this.lock === null
    if (this.medium === 'air' && this.grounded && free && drift) {
      this.lastSafeT += dt
      if (this.lastSafeT > 0.5 && this.groundKind !== 'net') {
        this.lastSafeT = 0
        this.lastSafeLocal = drift.toLocal(this.pos)
        s.hero.lastSafe = { x: this.pos.x, y: this.pos.y, z: this.pos.z }
      }
    }
    if (this.medium === 'air' && free && this.grounded) {
      const trying = Math.hypot(ctx.input.move.x, ctx.input.move.y) > 0.5
      const moved = Math.hypot(this.vel.x, this.vel.z)
      if (trying && moved < 0.05 && !this.blockedAhead()) this.stuckT += dt
      else this.stuckT = Math.max(0, this.stuckT - dt)
      if (this.stuckT > INDOOR.stuckSnapSeconds) {
        this.stuckT = 0
        this.recover()
      }
    }
    if (this.medium === 'air' && drift) this.localPos = v3(drift.toLocal(this.pos))
  }

  private writeState(): void {
    const h = this.ctx.state.hero
    h.position = { x: this.pos.x, y: this.pos.y, z: this.pos.z }
    h.velocity = { x: this.vel.x, y: this.vel.y, z: this.vel.z }
    h.yaw = this.yaw
    h.mode = this.mode as HeroMode
    h.medium = this.medium
    h.room = this.medium === 'air' ? this.room : null
    h.wetness = this.wetness
    h.localPosition = this.localPos ? { x: this.localPos.x, y: this.localPos.y, z: this.localPos.z } : null
  }
}
