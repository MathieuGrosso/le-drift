import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { BLEU_EDGE, CEILING_Y, HERO_MAX_Y } from '../core/layout'
import { INDOOR, MOVE, PHYSICS } from '../core/tuning'
import type { ColliderKind, GameContext, HeroMode, Medium, RoomId, Vec3 } from '../core/types'
import type { ClipId } from './anim'

const PARK = { x: 0, y: -5000, z: 0 }
const CAP_HALF = 0.5
const CAP_R = 0.3
const CAP_CENTER = CAP_HALF + CAP_R
const CHEST = 1.15
const SEAT_DROP = 0.43
const WALK_WATER_SLOPE = 50 * (Math.PI / 180)
const STEP_SURFACE: Partial<Record<ColliderKind, 'sable' | 'bois' | 'metal' | 'tapis'>> = {
  terrain: 'sable', rock: 'sable', coral: 'sable', shrine: 'sable', sonde: 'metal',
  hull: 'metal', window: 'metal', door: 'metal', ladder: 'metal', interior: 'bois', stair: 'bois', seat: 'bois', prop: 'bois',
}
const IGNORE: readonly ColliderKind[] = ['trigger', 'fauna']

export interface Ladder { id: string; bottom: Vec3; top: Vec3; normal: Vec3 }

type Activity =
  | { kind: 'none' }
  | { kind: 'sit'; seatId: string; anchor: THREE.Vector3; yaw: number; stage: 'approach' | 'down' | 'sit' | 'up'; t: number; standAt: THREE.Vector3 }
  | { kind: 'lean'; target: THREE.Vector3; stage: 'in' | 'lean' | 'up'; t: number }
  | { kind: 'sleep'; stage: 'down' | 'sleep' | 'up'; t: number }
  | { kind: 'ladder'; ladder: Ladder; s: number; topT: number }

const v3 = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z)
const forward = (yaw: number, out: THREE.Vector3) => out.set(Math.sin(yaw), 0, -Math.cos(yaw))
const yawOf = (x: number, z: number) => Math.atan2(x, -z)
function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export interface ControllerOut {
  clip: ClipId
  clipFade: number
  phase: number
  speed: number
  bank: number
  pitch: number
  climbX: number
  climbY: number
  scrubbing: boolean
  gliding: boolean
  sprinting: boolean
  moving: number
  inWater: boolean
  climbing: boolean
  riding: boolean
  freezeCamera: boolean
  lookAt: THREE.Vector3 | null
}

export class HeroController {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  yaw = 0
  mode: HeroMode = 'idle'
  medium: Medium = 'water'
  room: RoomId | null = null
  wetness = 0
  grounded = false
  groundKind: ColliderKind = 'terrain'
  groundNormal = new THREE.Vector3(0, 1, 0)
  out: ControllerOut = {
    clip: 'idle', clipFade: 0.22, phase: 0, speed: 0, bank: 0, pitch: 0, climbX: 0, climbY: 0,
    scrubbing: false, gliding: false, sprinting: false, moving: 0, inWater: true, climbing: false, riding: false,
    freezeCamera: false, lookAt: null,
  }

  private kcc: RAPIER.KinematicCharacterController
  private collider: RAPIER.Collider
  private climbN = new THREE.Vector3()
  private climbUp = new THREE.Vector3()
  private climbDelta = new THREE.Vector3()
  private scrubWant = new THREE.Vector3()
  private scrubFromClimb = false
  private climbJumpT = 99
  private mantleT = -1
  private mantleFrom = new THREE.Vector3()
  private mantleTo = new THREE.Vector3()
  private climbJumpDir = new THREE.Vector3()
  private kickT = 99
  private landT = 99
  private hatchT = 99
  private shakeT = 99
  private airT = 0
  private vyF = 0
  private phase = 0
  private stepIdx = 0
  private yawRate = 0
  private lastSafeT = 0
  private stuckT = 0
  private flattenT = 0
  private scrubEmitT = 0
  private scrubWindow: string | null = null
  private scrubDone = new Set<string>()
  private airlock: { dir: 'in' | 'out'; phase: 'close' | 'pump' | 'open' | 'done'; t: number } | null = null
  private activity: Activity = { kind: 'none' }
  private talking: string | null = null
  private recovering = false
  private localPos: THREE.Vector3 | null = null
  private lastHeading = 0
  private lastDriftPos = new THREE.Vector3()
  private wasGrounded = false
  private fallSpeed = 0
  private wish = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private flow = new THREE.Vector3()
  private stepCb: (left: boolean) => void = () => undefined
  private fader: ((mid: () => void) => Promise<void>) | null = null
  private unsubs: (() => void)[] = []

  constructor(private ctx: GameContext) {
    const R = ctx.physics.rapier
    const w = ctx.physics.world
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
        if (e.kind === 'door') this.hatchT = 0
        if (e.kind === 'ladder') this.grabLadderById(e.targetId)
      }),
      bus.on('dialogue:start', (e) => {
        this.talking = e.npcId
      }),
      bus.on('dialogue:end', () => {
        this.talking = null
      }),
      bus.on('sleep:done', () => {
        if (this.activity.kind === 'sleep') this.activity = { kind: 'sleep', stage: 'up', t: 0 }
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
    this.mode = this.medium === 'air' ? 'idle' : 'sink'
    this.syncLocal()
  }

  teleport(p: Vec3, yaw?: number): void {
    this.mantleT = -1
    this.pos.set(p.x, p.y, p.z)
    this.vel.set(0, 0, 0)
    if (yaw !== undefined) this.yaw = yaw
    this.activity = { kind: 'none' }
    this.climbJumpT = 99
    const drift = this.ctx.services.drift
    this.medium = drift ? drift.mediumAt(this.tmp.copy(this.pos).setY(this.pos.y + 1)) : 'water'
    if (this.medium === 'air') this.room = drift?.roomAt(this.pos) ?? this.ctx.state.hero.room
    if (this.medium === 'water') this.room = null
    this.setMode(this.medium === 'air' ? 'idle' : 'sink')
    this.syncLocal()
    this.writeState()
  }

  private syncLocal(): void {
    const drift = this.ctx.services.drift
    if (drift && this.medium === 'air') {
      this.localPos = v3(drift.toLocal(this.pos))
      const p = drift.pose()
      this.lastHeading = p.heading
      this.lastDriftPos.copy(v3(p.position))
    } else this.localPos = null
  }


  setMode(m: HeroMode): void {
    if (m === this.mode) return
    const from = this.mode
    if (m === 'sleep') this.activity = { kind: 'sleep', stage: 'down', t: 0 }
    else if (from === 'sleep' && this.activity.kind === 'sleep') this.activity = { kind: 'sleep', stage: 'up', t: 0 }
    if (m === 'climb' && from !== 'climb') {
      if (!this.findWall(true)) return
    }
    if (m === 'cutscene' || m === 'airlock') this.vel.set(0, 0, 0)
    this.mode = m
    this.ctx.bus.emit('hero:mode', { from, to: m })
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
    } else if (a.kind === 'lean') {
      a.stage = 'up'
      a.t = 0
    } else if (a.kind === 'sleep') {
      a.stage = 'up'
      a.t = 0
    } else this.activity = { kind: 'none' }
  }


  update(dt: number, camYaw: number): void {
    const ctx = this.ctx
    const t = ctx.clock.elapsed
    this.kickT += dt
    this.landT += dt
    this.hatchT += dt
    this.shakeT += dt
    this.climbJumpT += dt
    const prevYaw = this.yaw

    this.followDrift()
    this.updateMedium()

    const input = ctx.input
    const locked = this.mode === 'cutscene' || this.mode === 'airlock' || ctx.clock.paused
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

    if (this.mantleT >= 0) this.updateMantle(dt)
    else if (this.mode === 'airlock') this.updateAirlock(dt)
    else if (this.mode === 'cutscene') this.updateCutscene(dt)
    else if (this.mode === 'ride') this.updateRide(dt, locked)
    else if (this.medium === 'air') this.updateAir(dt, wishLen, locked)
    else this.updateWater(dt, wishLen, locked)

    this.yawRate = angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-4)
    out.bank += (THREE.MathUtils.clamp(-this.yawRate * 0.22, -0.7, 0.7) - out.bank) * Math.min(1, dt * 5)
    out.inWater = this.medium === 'water'
    out.phase = this.phase
    if (this.talking) out.lookAt = this.npcLook()

    this.housekeeping(dt, t)
    this.writeState()
  }

  private followDrift(): void {
    const drift = this.ctx.services.drift
    if (!drift || this.medium !== 'air' || !this.localPos) return
    const w = drift.toWorld(this.localPos)
    this.pos.set(w.x, w.y, w.z)
    const pose = drift.pose()
    const dh = angleDiff(this.lastHeading, pose.heading)
    this.yaw += dh
    this.lastHeading = pose.heading
    this.lastDriftPos.set(pose.position.x, pose.position.y, pose.position.z)
  }

  private updateMedium(): void {
    const drift = this.ctx.services.drift
    if (this.mode === 'airlock') return
    let m: Medium = 'water'
    if (drift) m = drift.mediumAt(this.tmp.copy(this.pos).setY(this.pos.y + 1))
    if (m === this.medium) {
      if (m === 'air' && drift) this.trackRoom(drift.roomAt(this.pos))
      return
    }
    if (this.medium === 'air' && m === 'water' && drift && !this.recovering) {
      this.snapToRoom()
      return
    }
    this.setMedium(m)
  }

  private setMedium(m: Medium): void {
    if (m === this.medium) return
    this.medium = m
    if (m === 'water') {
      this.wetness = 1
      this.trackRoom(null)
      this.activity = { kind: 'none' }
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

  private snapToRoom(): void {
    const drift = this.ctx.services.drift
    if (!drift) return
    const s = drift.roomSpawn(this.room ?? 'sas')
    this.pos.copy(v3(s.position))
    this.yaw = s.yaw
    this.vel.set(0, 0, 0)
    this.stuckT = 0
    this.syncLocal()
  }


  private breath() {
    return this.ctx.services.gameplay?.breath
  }
  private canAct(): boolean {
    const b = this.breath()
    return (b ? b.canAct() : true) && !this.ctx.state.hero.exhausted
  }
  private spend(c: number): boolean {
    const b = this.breath()
    return b ? b.spend(c) : true
  }
  private drain(rate: number, dt: number): boolean {
    const b = this.breath()
    return b ? b.drain(rate, dt) : true
  }
  private hasVoile(): boolean {
    const g = this.ctx.services.gameplay
    if (g) return g.hasItem('voile')
    return (this.ctx.state.inventory.items['voile'] ?? 0) > 0
  }

  private updateWater(dt: number, wishLen: number, locked: boolean): void {
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

    out.scrubbing = false
    out.gliding = false
    out.sprinting = false
    out.climbing = false
    out.riding = false
    out.pitch = 0

    if (this.mode === 'scrub' || (!locked && input.down('scrub'))) {
      if (this.updateScrub(dt, locked)) return
    }
    if (this.mode === 'climb') {
      this.updateClimb(dt, locked)
      return
    }
    if (this.mode === 'glide') {
      this.updateGlide(dt, locked)
      return
    }

    const sprint = !locked && input.down('sprint') && wishLen > 0.1 && !exhausted
    if (this.grounded && this.vel.y <= 0.01) {
      let speed = (sprint ? MOVE.run : MOVE.walk) * slow * wishLen
      if (sprint && !this.drain(MOVE.sprintCostFloor, dt)) speed = MOVE.walk * slow * wishLen
      out.sprinting = sprint
      this.steerHorizontal(dt, speed, 9, 10)
      this.vel.y = 0
      if (!locked && input.pressed('up')) {
        if (this.wallAhead() && this.canAct()) this.startClimb()
        else this.kick()
      } else if (wishLen > 0.3 && this.canAct() && this.wallAhead(0.55, true)) this.startClimb()
      if (!this.isMode('climb')) {
        this.setModeQuiet(exhausted ? 'exhausted' : wishLen > 0.05 ? 'walk' : 'idle')
        this.moveKcc(dt, this.vel.y > 0 ? 0 : 0.3)
      }
    } else {
      let speed = (sprint ? MOVE.swimSprint : MOVE.swim) * slow * wishLen
      if (sprint && !this.drain(MOVE.sprintCostSwim, dt)) speed = MOVE.swim * slow * wishLen
      out.sprinting = sprint
      this.steerHorizontal(dt, speed, sprint ? 3.5 : 4.5, sprint ? 3 : 5)
      const lest = ctx.state.hero.lestOn
      let targetVy = lest ? -MOVE.sinkTerminal : 0.6
      if (!locked && input.down('down')) targetVy = -MOVE.descend
      const rate = this.vel.y > targetVy ? 1.6 : 3
      this.vel.y += (targetVy - this.vel.y) * Math.min(1, rate * dt)
      if (!locked && input.pressed('up')) {
        const floor = this.floorDistance()
        if (this.wallAhead(0.8) && this.canAct()) this.startClimb()
        else if (this.hasVoile() && this.vel.y < -0.4 && this.kickT > 0.5 && floor > 3 && this.canAct()) this.openGlide()
        else this.kick()
      } else if (wishLen > 0.3 && this.canAct() && this.wallAhead(0.5, true)) this.startClimb()
      if (!this.isMode('climb') && !this.isMode('glide')) {
        const h = Math.hypot(this.vel.x, this.vel.z)
        this.setModeQuiet(exhausted ? 'exhausted' : h > 0.6 || this.kickT < 0.6 ? 'swim' : 'sink')
        out.pitch = THREE.MathUtils.clamp(this.vel.y / 4, -0.6, 0.7)
        this.moveKcc(dt, 0)
      }
    }
    this.pickWaterClip(sprint)
  }

  private isMode(m: HeroMode): boolean {
    return this.mode === m
  }

  private setModeQuiet(m: HeroMode): void {
    if (m !== this.mode) this.setMode(m)
  }

  private steerHorizontal(dt: number, speed: number, accel: number, turn: number): void {
    const tx = this.wish.x === 0 && this.wish.z === 0 ? 0 : (this.wish.x / Math.max(this.wish.length(), 1e-4)) * speed
    const tz = this.wish.x === 0 && this.wish.z === 0 ? 0 : (this.wish.z / Math.max(this.wish.length(), 1e-4)) * speed
    const a = Math.min(1, accel * dt)
    this.vel.x += (tx - this.vel.x) * a
    this.vel.z += (tz - this.vel.z) * a
    if (speed > 0.05) {
      const target = yawOf(this.wish.x, this.wish.z)
      this.yaw += angleDiff(this.yaw, target) * Math.min(1, turn * dt)
    }
  }

  private kick(): void {
    if (!this.spend(MOVE.kickCost)) return
    this.vel.y = Math.max(this.vel.y, 0) + MOVE.kickImpulse
    this.kickT = 0
    this.grounded = false
    this.ctx.bus.emit('hero:kick', {})
  }

  private pickWaterClip(sprint: boolean): void {
    const out = this.out
    const h = Math.hypot(this.vel.x, this.vel.z)
    out.speed = h
    out.moving = Math.min(1, h / MOVE.swim)
    if (this.mode === 'exhausted') return this.clip('exhausted')
    if (this.grounded) {
      if (this.landT < 0.4) return this.clip('land', 0.08)
      if (h > 0.25) {
        const run = sprint && h > 3
        this.phase += (h * this.dtLast) / (run ? 2.4 : 1.5)
        this.stepCheck()
        return this.clip(run ? 'run' : 'walk')
      }
      return this.clip(this.talking ? 'talk' : 'idle-floor', 0.35)
    }
    if (this.kickT < 0.55) return this.clip('kick', 0.08)
    if (h > 3.6) {
      this.phase += this.dtLast * 1.25
      return this.clip('swim-sprint', 0.3)
    }
    if (h > 0.6) {
      this.phase += this.dtLast * (0.45 + h * 0.12)
      return this.clip('swim', 0.3)
    }
    return this.clip(this.vel.y > -0.8 ? 'idle' : 'sink', 0.4)
  }

  private dtLast = 1 / 60

  private clip(id: ClipId, fade = 0.22): void {
    this.out.clip = id
    this.out.clipFade = fade
  }

  private floorDistance(): number {
    const hit = this.ctx.physics.raycast(this.pos, { x: 0, y: -1, z: 0 }, 40, { excludeKinds: [...IGNORE] })
    const ground = this.ctx.services.world?.heightAt(this.pos.x, this.pos.z)
    let d = hit ? hit.distance : 40
    if (ground !== undefined) d = Math.min(d, this.pos.y - ground)
    return d
  }


  private wallAhead(reach = 0.7, moving = false): boolean {
    const dir = moving && this.wish.lengthSq() > 0.01 ? this.tmp2.copy(this.wish).normalize() : forward(this.yaw, this.tmp2)
    const origin = { x: this.pos.x, y: this.pos.y + CHEST, z: this.pos.z }
    const hit = this.ctx.physics.raycast(origin, dir, CAP_R + reach, { excludeKinds: [...IGNORE] })
    if (!hit) return false
    if (hit.tag && !hit.tag.climbable) return false
    if (Math.abs(hit.normal.y) > 0.62) return false
    this.climbN.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
    return true
  }

  private findWall(useYaw: boolean): boolean {
    const dir = useYaw ? forward(this.yaw, this.tmp2) : this.tmp2.copy(this.climbN).negate()
    const origin = { x: this.pos.x, y: this.pos.y + CHEST, z: this.pos.z }
    const hit = this.ctx.physics.raycast(origin, dir, 1.2, { excludeKinds: [...IGNORE] })
    if (!hit || (hit.tag && !hit.tag.climbable) || hit.normal.y > 0.8) return false
    this.climbN.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize()
    return true
  }

  private startClimb(): void {
    this.vel.set(0, 0, 0)
    this.yaw = yawOf(-this.climbN.x, -this.climbN.z)
    this.setMode('climb')
    this.out.climbing = true
  }

  private letGo(push = 1): void {
    this.vel.copy(this.climbN).multiplyScalar(push)
    this.vel.y = Math.min(this.vel.y, 0)
    this.setMode(this.medium === 'air' ? 'fall' : 'sink')
  }

  private updateClimb(dt: number, locked: boolean): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    out.climbing = true
    const strong = this.flow.length() > 4
    const n = this.climbN
    const right = this.tmp.set(n.z, 0, -n.x)
    if (right.lengthSq() < 1e-4) right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw))
    right.normalize()
    const up = this.climbUp.crossVectors(n, right).normalize()
    const mx = locked ? 0 : input.move.x
    const my = locked ? 0 : input.move.y
    const moving = Math.hypot(mx, my) > 0.1

    if (ctx.state.hero.exhausted || !this.drain((moving ? MOVE.climbCostMoving : MOVE.climbCostHanging) * (strong ? MOVE.strongCurrentClimbMul : 1), dt)) {
      this.letGo(0.6)
      return
    }
    if (!locked && input.pressed('down')) {
      this.letGo(1.2)
      return
    }
    const delta = this.climbDelta.set(0, 0, 0)
    if (this.climbJumpT < 0.35) {
      delta.copy(this.climbJumpDir).multiplyScalar((MOVE.climbJump / 0.35) * dt)
    } else if (!locked && input.pressed('up') && this.spend(MOVE.climbJumpCost)) {
      this.climbJumpT = 0
      this.climbJumpDir.copy(up).multiplyScalar(my >= -0.2 ? Math.max(0.5, my) : my).addScaledVector(right, mx)
      if (this.climbJumpDir.lengthSq() < 0.01) this.climbJumpDir.copy(up)
      this.climbJumpDir.normalize()
    } else {
      delta.copy(right).multiplyScalar(mx).addScaledVector(up, my)
      if (delta.lengthSq() > 1) delta.normalize()
      delta.multiplyScalar(MOVE.climbSpeed * dt)
    }
    if (strong) delta.y -= 0.3 * dt
    if (moving || this.climbJumpT < 0.35) this.phase += (Math.max(Math.hypot(mx, my), 0.6) * MOVE.climbSpeed * dt) / 0.9

    const origin = { x: this.pos.x + delta.x, y: this.pos.y + CHEST + delta.y, z: this.pos.z + delta.z }
    const hit = ctx.physics.raycast(origin, { x: -n.x, y: -n.y, z: -n.z }, 1.3, { excludeKinds: [...IGNORE] })
    if (!hit) {
      if (my > 0.1 || this.climbJumpT < 0.35) {
        this.mantle(n)
        return
      }
      this.letGo(0.3)
      return
    }
    if (hit.normal.y > 0.8) {
      this.mantle(n)
      return
    }
    n.lerp(this.tmp2.set(hit.normal.x, hit.normal.y, hit.normal.z), Math.min(1, dt * 10)).normalize()
    const gap = hit.distance - (CAP_R + 0.05)
    delta.addScaledVector(n, -gap)
    this.freeKcc()
    this.moveRaw(delta)
    if (this.grounded && my < -0.3 && n.y < 0.5) {
      this.setMode('idle')
      return
    }
    this.yaw = yawOf(-n.x, -n.z)
    out.pitch = -Math.asin(THREE.MathUtils.clamp(n.y, -0.9, 0.9)) * 0.8
    out.speed = moving ? MOVE.climbSpeed : 0
    out.moving = 0
    if (this.climbJumpT < 0.4) this.clip('climb-jump', 0.08)
    else this.clip(moving ? 'climb' : 'climb-idle', 0.18)
  }

  private mantle(n: THREE.Vector3): void {
    const probe = { x: this.pos.x - n.x * 0.6, y: this.pos.y + 2.6, z: this.pos.z - n.z * 0.6 }
    const top = this.ctx.physics.raycast(probe, { x: 0, y: -1, z: 0 }, 2.6, { excludeKinds: [...IGNORE] })
    if (top && top.normal.y > 0.6) {
      this.mantleFrom.copy(this.pos)
      this.mantleTo.set(top.point.x, top.point.y + 0.02, top.point.z)
      this.mantleT = 0
      this.vel.set(0, 0, 0)
      return
    }
    this.vel.set(-n.x * 1.8, 3.2, -n.z * 1.8)
    this.kickT = 0.2
    this.setMode(this.medium === 'air' ? 'fall' : 'swim')
  }

  private updateMantle(dt: number): void {
    this.mantleT += dt / 0.55
    const k = Math.min(1, this.mantleT)
    const up = Math.min(1, k / 0.6)
    const fwd = Math.max(0, (k - 0.35) / 0.65)
    this.pos.set(
      THREE.MathUtils.lerp(this.mantleFrom.x, this.mantleTo.x, fwd * fwd * (3 - 2 * fwd)),
      THREE.MathUtils.lerp(this.mantleFrom.y, this.mantleTo.y, Math.sin((up * Math.PI) / 2)),
      THREE.MathUtils.lerp(this.mantleFrom.z, this.mantleTo.z, fwd * fwd * (3 - 2 * fwd)),
    )
    this.out.climbing = true
    this.out.speed = 0
    this.out.moving = 0
    this.clip('climb-jump', 0.1)
    if (k >= 1) {
      this.mantleT = -1
      this.grounded = true
      this.wasGrounded = true
      this.landT = 0
      this.setMode('idle')
    }
  }


  private openGlide(): void {
    this.setMode('glide')
    this.vel.y = Math.max(this.vel.y, -MOVE.voileSink)
  }

  private updateGlide(dt: number, locked: boolean): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    out.gliding = true
    if (!locked && (input.pressed('up') || input.pressed('down'))) {
      this.setMode('sink')
      return
    }
    if (!this.drain(MOVE.voileCost, dt)) {
      this.setMode('sink')
      return
    }
    if (this.wish.lengthSq() > 0.01) {
      const target = yawOf(this.wish.x, this.wish.z)
      this.yaw += THREE.MathUtils.clamp(angleDiff(this.yaw, target), -1, 1) * 1.9 * dt
    }
    const f = forward(this.yaw, this.tmp2)
    const a = Math.min(1, 1.6 * dt)
    this.vel.x += (f.x * MOVE.voileForward - this.vel.x) * a
    this.vel.z += (f.z * MOVE.voileForward - this.vel.z) * a
    this.vel.y += (-MOVE.voileSink - this.vel.y) * Math.min(1, 2 * dt)
    this.moveKcc(dt, 0, 1.4)
    if (this.grounded) {
      this.setMode('idle')
      return
    }
    if (this.wallAhead(0.4) && this.canAct()) {
      this.startClimb()
      return
    }
    out.pitch = THREE.MathUtils.clamp(this.vel.y / 3, -0.5, 0.5)
    out.speed = MOVE.voileForward
    out.moving = 1
    this.clip('glide', 0.3)
  }


  private updateScrub(dt: number, locked: boolean): boolean {
    const ctx = this.ctx
    const drift = ctx.services.drift
    const holding = !locked && ctx.input.down('scrub')
    if (!drift || !holding) {
      if (this.mode === 'scrub') this.endScrub()
      this.scrubWindow = null
      return false
    }
    const chest = this.tmp.set(this.pos.x, this.pos.y + CHEST, this.pos.z)
    const w = drift.nearestWindow(chest, 1.9)
    if (!w) {
      if (this.mode === 'scrub') this.endScrub()
      return false
    }
    if (this.mode !== 'scrub') {
      this.scrubFromClimb = this.mode === 'climb'
      this.setMode('scrub')
    }
    const wasClimbing = this.scrubFromClimb
    this.out.scrubbing = true
    const n = this.tmp2.set(w.normal.x, w.normal.y, w.normal.z).normalize()
    this.yaw += angleDiff(this.yaw, yawOf(-n.x, -n.z)) * Math.min(1, dt * 8)
    const want = this.scrubWant.set(w.position.x, w.position.y - CHEST + 0.1, w.position.z).addScaledVector(n, 0.75)
    const toWant = want.sub(this.pos)
    if (!wasClimbing) {
      const pull = Math.min(1, dt * 2.5)
      this.vel.set(toWant.x * 2.5, toWant.y * 2.5, toWant.z * 2.5)
      this.freeKcc()
      this.moveRaw(this.tmp.copy(toWant).multiplyScalar(pull))
    }
    this.drain(0.01, dt)
    const remaining = drift.scrub(w.id, 0.45 * dt)
    this.scrubEmitT -= dt
    if (this.scrubEmitT <= 0) {
      this.scrubEmitT = 0.1
      ctx.bus.emit('scrub:progress', { windowId: w.id, coat: remaining })
    }
    if (remaining <= 0.001) {
      if (!this.scrubDone.has(w.id)) {
        this.scrubDone.add(w.id)
        ctx.bus.emit('scrub:done', { windowId: w.id })
      }
    } else this.scrubDone.delete(w.id)
    this.scrubWindow = w.id
    this.out.speed = 0
    this.out.moving = 0
    this.clip('scrub', 0.25)
    return true
  }

  private endScrub(): void {
    if (this.scrubFromClimb && this.findWall(true)) this.setMode('climb')
    else this.setMode('sink')
    this.scrubFromClimb = false
  }


  private updateAir(dt: number, wishLen: number, locked: boolean): void {
    const ctx = this.ctx
    const input = ctx.input
    const out = this.out
    out.scrubbing = out.gliding = out.climbing = out.riding = false
    out.pitch = 0
    out.sprinting = false
    if (this.activity.kind !== 'none') {
      if (this.updateActivity(dt, wishLen, locked)) return
    }
    if (this.mode === 'glide' || this.mode === 'swim' || this.mode === 'sink' || this.mode === 'scrub') this.setMode('fall')
    if (this.mode === 'climb') {
      this.updateClimb(dt, locked)
      return
    }
    const run = !locked && input.down('sprint') && wishLen > 0.1
    const exhausted = ctx.state.hero.exhausted
    if (this.grounded) {
      const speed = (run ? INDOOR.run : INDOOR.walk) * wishLen * (exhausted ? MOVE.exhaustedSpeedMul : 1)
      this.steerHorizontal(dt, speed, 12, 12)
      this.vel.y = 0
      if (!locked && input.pressed('up')) {
        this.vel.y = Math.sqrt(2 * -PHYSICS.indoorGravity * INDOOR.hopHeight)
        this.grounded = false
      }
      if (wishLen > 0.3 && this.tryLadder(false)) return
    } else {
      this.steerHorizontal(dt, Math.hypot(this.vel.x, this.vel.z), 2, 4)
      this.vel.y += PHYSICS.indoorGravity * dt
      this.vel.y = Math.max(this.vel.y, -20)
    }
    const prevY = this.pos.y
    this.moveKcc(dt, this.vel.y > 0 ? 0 : INDOOR.stepHeight)
    this.vyF += ((this.pos.y - prevY) / Math.max(dt, 1e-4) - this.vyF) * Math.min(1, dt * 5)
    const h = Math.hypot(this.vel.x, this.vel.z)
    out.speed = h
    out.moving = Math.min(1, h / INDOOR.walk)
    out.sprinting = run
    if (!this.grounded) {
      this.airT += dt
      this.setModeQuiet('fall')
      if (this.airT > 0.25 || this.vel.y < -3) return this.clip('fall', 0.2)
      return
    }
    this.airT = 0
    this.setModeQuiet(h > 0.05 ? 'walk' : 'idle')
    if (this.landT < 0.35) return this.clip('land-dry', 0.06)
    if (this.shakeT < 1.3) return this.clip('shake-off', 0.15)
    if (this.hatchT < INDOOR.hatchSpinSeconds) return this.clip('open-hatch', 0.15)
    if (h > 0.25) {
      const runClip = h > 2.6
      this.phase += (h * dt) / (runClip ? 2.1 : 1.15)
      this.stepCheck()
      const dy = this.vyF
      if (this.groundKind === 'stair' && Math.abs(dy) > 0.12 && !runClip) return this.clip(dy > 0 ? 'stairs-up' : 'stairs-down', 0.2)
      return this.clip(runClip ? 'run-dry' : 'walk-dry', 0.2)
    }
    return this.clip(this.talking ? 'talk' : exhausted ? 'exhausted' : 'idle-dry', 0.3)
  }

  private updateActivity(dt: number, wishLen: number, locked: boolean): boolean {
    const a = this.activity
    const ctx = this.ctx
    const input = ctx.input
    const wantsUp = !locked && (wishLen > 0.35 || input.pressed('down'))
    if (a.kind === 'ladder') return this.updateLadder(dt, a, locked)
    if (a.kind === 'sit') {
      a.t += dt
      if (a.stage === 'approach') {
        const to = this.tmp.copy(a.anchor).sub(this.pos)
        to.y = 0
        const d = to.length()
        if (d < 0.5 || a.t > 3) {
          a.standAt.copy(this.pos)
          this.yaw = a.yaw
          a.stage = 'down'
          a.t = 0
          this.setModeQuiet('sit')
          this.syncLocal()
        } else {
          this.wish.copy(to).normalize()
          this.steerHorizontal(dt, Math.min(INDOOR.walk, d * 3), 12, 12)
          this.vel.y = 0
          this.moveKcc(dt, INDOOR.stepHeight)
          this.phase += (Math.hypot(this.vel.x, this.vel.z) * dt) / 1.15
          this.stepCheck()
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
        const h = ctx.state.time.hours
        const meal = this.room === 'refectoire' && ((h >= 7.5 && h < 8.5) || (h >= 19 && h < 21))
        this.clip(meal ? 'eat' : this.talking ? 'sit' : 'sit', 0.4)
        if (wantsUp) {
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
          this.setModeQuiet('idle')
        }
      }
      return true
    }
    if (a.kind === 'lean') {
      a.t += dt
      const to = this.tmp.copy(a.target).sub(this.pos)
      this.yaw += angleDiff(this.yaw, yawOf(to.x, to.z)) * Math.min(1, dt * 8)
      this.vel.set(0, 0, 0)
      this.out.speed = 0
      this.out.moving = 0
      if (a.stage !== 'up') {
        this.setModeQuiet('lean')
        this.clip('lean', 0.45)
        if (wantsUp) {
          a.stage = 'up'
          a.t = 0
        }
      } else {
        this.clip('idle-dry', 0.4)
        if (a.t > 0.4) {
          this.activity = { kind: 'none' }
          this.setModeQuiet('idle')
        }
      }
      return true
    }
    if (a.kind === 'sleep') {
      a.t += dt
      this.vel.set(0, 0, 0)
      this.out.speed = 0
      this.out.moving = 0
      if (a.stage === 'down') {
        this.clip('lie-down', 0.2)
        if (a.t > 1) {
          a.stage = 'sleep'
          a.t = 0
        }
      } else if (a.stage === 'sleep') {
        this.clip('sleep', 0.4)
        if (this.mode !== 'sleep') {
          a.stage = 'up'
          a.t = 0
        }
      } else {
        this.clip('wake', 0.1)
        if (a.t > 1) {
          this.activity = { kind: 'none' }
          if (this.mode === 'sleep') this.setMode('idle')
        }
      }
      return true
    }
    return false
  }

  private grabLadderById(id: string): void {
    const drift = this.ctx.services.drift
    if (!drift || !this.room) return
    const l = drift.ladders(this.room).find((x) => x.id === id)
    if (l) this.attachLadder(l)
  }

  private tryLadder(fromTop: boolean): boolean {
    const drift = this.ctx.services.drift
    if (!drift || !this.room) return false
    for (const l of drift.ladders(this.room)) {
      const b = l.bottom
      const tp = l.top
      const nb = Math.hypot(this.pos.x - b.x, this.pos.z - b.z)
      const facing = forward(this.yaw, this.tmp2)
      const into = -(facing.x * l.normal.x + facing.z * l.normal.z)
      if (!fromTop && nb < 0.7 && Math.abs(this.pos.y - b.y) < 0.6 && into > 0.5) {
        this.attachLadder(l)
        return true
      }
      const nt = Math.hypot(this.pos.x - tp.x, this.pos.z - tp.z)
      if (nt < 0.6 && Math.abs(this.pos.y - tp.y) < 0.6 && into < -0.5) {
        this.attachLadder(l, 1)
        return true
      }
    }
    return false
  }

  private attachLadder(l: Ladder, s?: number): void {
    const b = l.bottom
    const len = Math.max(0.1, l.top.y - b.y)
    const start = s ?? THREE.MathUtils.clamp((this.pos.y - b.y) / len, 0, 1)
    this.activity = { kind: 'ladder', ladder: l, s: Math.min(start, 0.98), topT: -1 }
    this.vel.set(0, 0, 0)
    this.setMode('ladder')
  }

  private updateLadder(dt: number, a: Extract<Activity, { kind: 'ladder' }>, locked: boolean): boolean {
    const input = this.ctx.input
    const l = a.ladder
    const bottom = v3(l.bottom)
    const top = v3(l.top)
    const n = v3(l.normal).normalize()
    const len = Math.max(0.1, bottom.distanceTo(top))
    this.yaw = yawOf(-n.x, -n.z)
    this.out.speed = 0
    this.out.moving = 0
    if (a.topT >= 0) {
      a.topT += dt
      const k = Math.min(1, a.topT / 0.9)
      const over = top.clone().addScaledVector(n, -0.55)
      this.pos.lerpVectors(top.clone().addScaledVector(n, 0.35), over, k * k)
      this.pos.y = top.y + Math.sin(k * Math.PI) * 0.15
      this.clip('ladder-top', 0.1)
      if (k >= 1) {
        this.activity = { kind: 'none' }
        this.setMode('idle')
      }
      this.syncLocal()
      return true
    }
    const my = locked ? 0 : input.move.y
    if (!locked && input.pressed('down')) {
      this.activity = { kind: 'none' }
      this.vel.copy(n).multiplyScalar(0.8)
      this.setMode('fall')
      return true
    }
    a.s += (my * INDOOR.ladderSpeed * dt) / len
    this.phase += (Math.abs(my) * INDOOR.ladderSpeed * dt) / 0.7
    if (a.s >= 1) {
      a.s = 1
      if (my > 0.2 || (!locked && input.pressed('up'))) a.topT = 0
    }
    if (a.s <= 0 && my < -0.2) {
      a.s = 0
      this.activity = { kind: 'none' }
      this.setMode('idle')
      return true
    }
    a.s = THREE.MathUtils.clamp(a.s, 0, 1)
    this.pos.lerpVectors(bottom, top, a.s).addScaledVector(n, 0.35)
    this.syncLocal()
    this.clip('ladder', 0.2)
    return true
  }


  private onAirlock(dir: 'in' | 'out', phase: 'close' | 'pump' | 'open' | 'done'): void {
    if (phase === 'close') {
      this.airlock = { dir, phase, t: 0 }
      this.activity = { kind: 'none' }
      this.setMode('airlock')
      return
    }
    if (!this.airlock) this.airlock = { dir, phase, t: 0 }
    this.airlock.phase = phase
    this.airlock.t = 0
    if (phase === 'pump' && dir === 'out') this.setMedium('water')
    if (phase === 'done') {
      if (dir === 'in') this.setMedium('air')
      else this.setMedium('water')
      this.airlock = null
      this.setMode(this.medium === 'air' ? 'idle' : 'sink')
    }
  }

  private updateAirlock(dt: number): void {
    const al = this.airlock
    this.out.speed = 0
    this.out.moving = 0
    if (!al) {
      this.setMode(this.medium === 'air' ? 'idle' : 'sink')
      return
    }
    al.t += dt
    if (al.dir === 'in' && al.phase === 'pump') {
      if (this.medium === 'water' && al.t > 1.6) {
        this.setMedium('air')
        this.landT = 0
        this.shakeT = -0.35
      }
    }
    if (this.medium === 'air') {
      this.vel.x = this.vel.z = 0
      this.vel.y = this.grounded ? 0 : this.vel.y + PHYSICS.indoorGravity * dt
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
    const lest = this.ctx.state.hero.lestOn
    this.out.speed = 0
    this.out.moving = 0
    if (this.medium === 'water' && !lest) {
      const top = CEILING_Y - 1.75
      this.vel.set(0, this.pos.y < top ? 0.9 : 0, 0)
      this.pos.y = Math.min(top, this.pos.y + this.vel.y * dt)
      this.clip(this.pos.y > top - 1.5 ? 'hand-on-ceiling' : 'idle', 0.8)
      return
    }
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 3))
    this.clip(this.medium === 'air' ? 'idle-dry' : this.grounded ? 'idle-floor' : 'idle', 0.4)
  }

  private updateRide(dt: number, locked: boolean): void {
    const manta = this.ctx.services.fauna?.manta()
    this.out.riding = true
    if (!manta || (!locked && this.ctx.input.pressed('down'))) {
      manta?.dismount()
      this.setMode('sink')
      return
    }
    const p = manta.position
    const dx = p.x - this.pos.x
    const dz = p.z - this.pos.z
    if (dx * dx + dz * dz > 1e-4) this.yaw += angleDiff(this.yaw, yawOf(dx, dz)) * Math.min(1, dt * 4)
    this.vel.set(dx / Math.max(dt, 1e-3), (p.y + 0.55 - this.pos.y) / Math.max(dt, 1e-3), dz / Math.max(dt, 1e-3))
    this.pos.set(p.x, p.y + 0.55, p.z)
    this.out.speed = Math.hypot(this.vel.x, this.vel.z)
    this.out.moving = 1
    this.clip('ride', 0.3)
  }


  private filter = (c: RAPIER.Collider) => {
    const t = this.ctx.physics.tagOf(c.handle)
    return !t || !IGNORE.includes(t.kind)
  }

  private moveKcc(dt: number, step: number, currentMul = 1): void {
    this.dtLast = dt
    const d = this.tmp.copy(this.vel).multiplyScalar(dt)
    if (this.medium === 'water') {
      const k = this.grounded ? 0.3 : currentMul
      d.addScaledVector(this.flow, k * dt)
      if (this.grounded && (this.groundKind === 'hull' || this.groundKind === 'interior' || this.groundKind === 'stair')) {
        const dv = this.ctx.services.drift?.pose().velocity
        if (dv) d.set(d.x + dv.x * dt, d.y + dv.y * dt, d.z + dv.z * dt)
      }
    }
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
    this.moveRaw(d)
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
    c.setTranslation({ x: this.pos.x, y: this.pos.y + CAP_CENTER, z: this.pos.z })
    let mx = d.x
    let my = d.y
    let mz = d.z
    try {
      this.kcc.computeColliderMovement(c, { x: d.x, y: d.y, z: d.z }, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.filter)
      const m = this.kcc.computedMovement()
      mx = m.x
      my = m.y
      mz = m.z
      this.grounded = this.kcc.computedGrounded()
    } catch {
      this.grounded = false
    }
    c.setTranslation(PARK)
    this.pos.x += mx
    this.pos.y += my
    this.pos.z += mz
    if (Math.abs(my - d.y) > 1e-4 && d.y > 0 && my < d.y * 0.5) this.vel.y = Math.min(this.vel.y, 0)

    const world = this.ctx.services.world
    if (this.medium === 'water' && world) {
      const gy = world.heightAt(this.pos.x, this.pos.z)
      if (this.pos.y < gy) {
        this.pos.y = gy
        if (this.vel.y < 0) this.grounded = true
      } else if (this.pos.y - gy < 0.05 && this.vel.y <= 0) this.grounded = true
    } else if (!world && this.medium === 'water' && this.pos.y < 0) {
      this.pos.y = 0
      this.grounded = true
    }
    if (this.mode !== 'cutscene' && this.pos.y > HERO_MAX_Y) {
      this.pos.y += (HERO_MAX_Y - this.pos.y) * 0.2
      this.vel.y = Math.min(this.vel.y, -0.5)
    }
    this.probeGround()
    if (this.grounded && !this.wasGrounded) {
      const speed = Math.max(0, -this.fallSpeed)
      if (speed > (this.medium === 'air' ? 3.5 : 1.0)) this.landT = 0
      this.ctx.bus.emit('hero:landed', { speed, kind: this.groundKind })
    }
    this.fallSpeed = this.vel.y
    this.wasGrounded = this.grounded
  }

  private probeGround(): void {
    if (!this.grounded) return
    const hit = this.ctx.physics.raycast({ x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z }, { x: 0, y: -1, z: 0 }, 0.7, { excludeKinds: [...IGNORE] })
    if (hit) {
      this.groundKind = hit.tag?.kind ?? 'terrain'
      this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z)
    } else {
      this.groundKind = 'terrain'
      const n = this.ctx.services.world?.normalAt(this.pos.x, this.pos.z)
      if (n) this.groundNormal.set(n.x, n.y, n.z)
      else this.groundNormal.set(0, 1, 0)
    }
  }

  private stepCheck(): void {
    const idx = Math.floor(this.phase * 2)
    if (idx !== this.stepIdx) {
      this.stepIdx = idx
      const left = (idx & 1) === 0
      this.ctx.bus.emit('hero:step', {
        surface: STEP_SURFACE[this.groundKind] ?? 'sable',
        wet: this.wetness > 0.1,
      })
      this.stepCb(left)
    }
  }

  private npcLook(): THREE.Vector3 | null {
    if (!this.talking) return null
    const p = this.ctx.services.drift?.npcPosition(this.talking)
    return p ? v3(p) : null
  }

  private housekeeping(dt: number, t: number): void {
    const ctx = this.ctx
    const s = ctx.state
    if (this.medium === 'water') this.wetness = 1
    else this.wetness = Math.max(0, this.wetness - dt / INDOOR.wetnessDrySeconds)

    if (this.medium === 'water' && this.grounded) {
      this.flattenT -= dt
      if (this.flattenT <= 0) {
        this.flattenT = 0.1
        ctx.services.flora?.flatten(this.pos, 0.6)
      }
      this.lastSafeT += dt
      if (this.lastSafeT > 1) {
        this.lastSafeT = 0
        const region = ctx.services.world?.regionAt(this.pos.x, this.pos.z)
        if (region !== 'bleu' && Math.abs(this.pos.x) < BLEU_EDGE && Math.abs(this.pos.z) < BLEU_EDGE) {
          s.hero.lastSafe = { x: this.pos.x, y: this.pos.y, z: this.pos.z }
        }
      }
    }
    if (!this.recovering && this.medium === 'water' && (Math.abs(this.pos.x) > BLEU_EDGE + 25 || Math.abs(this.pos.z) > BLEU_EDGE + 25)) {
      this.recovering = true
      const back = s.hero.lastSafe
      const go = () => {
        this.teleport(back)
        this.recovering = false
      }
      if (this.fader) void this.fader(go)
      else go()
    }
    if (this.medium === 'air' && this.activity.kind === 'none' && this.mode !== 'airlock' && this.mode !== 'cutscene') {
      const tryingToMove = Math.hypot(ctx.input.move.x, ctx.input.move.y) > 0.5
      const moved = Math.hypot(this.vel.x, this.vel.z)
      if (tryingToMove && moved < 0.05) this.stuckT += dt
      else this.stuckT = Math.max(0, this.stuckT - dt)
      if (this.stuckT > INDOOR.stuckSnapSeconds) this.snapToRoom()
    }
    if (this.medium === 'air') {
      const drift = ctx.services.drift
      if (drift) this.localPos = v3(drift.toLocal(this.pos))
    }
    void t
  }

  private writeState(): void {
    const h = this.ctx.state.hero
    h.position = { x: this.pos.x, y: this.pos.y, z: this.pos.z }
    h.velocity = { x: this.vel.x, y: this.vel.y, z: this.vel.z }
    h.yaw = this.yaw
    h.mode = this.mode
    h.medium = this.medium
    h.room = this.medium === 'air' ? this.room : null
    h.wetness = this.wetness
    h.localPosition = this.localPos ? { x: this.localPos.x, y: this.localPos.y, z: this.localPos.z } : null
  }

  get scrubTarget(): string | null {
    return this.scrubWindow
  }
}
