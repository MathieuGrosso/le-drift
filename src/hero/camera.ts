import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { CEILING_Y } from '../core/layout'
import { CAMERA } from '../core/tuning'
import type { CameraPose, ColliderKind, GameContext } from '../core/types'
import { ceilingLocal } from './anchors'
import { WallFade } from './fade'

const D2R = Math.PI / 180

export type CameraStyle = 'walk' | 'climb' | 'ladder' | 'zip' | 'slide' | 'glide' | 'swim' | 'rest'

export interface CameraFrame {
  focus: THREE.Vector3
  chest: THREE.Vector3
  head: THREE.Vector3
  velocity: THREE.Vector3
  heroYaw: number
  moving: number
  indoor: boolean
  style: CameraStyle
  fast: boolean
  freeze: boolean
  headingDelta: number
}

const EXCLUDE: readonly ColliderKind[] = ['trigger', 'fauna', 'kelp', 'net', 'seat']
const ATRIUM = { distance: 5, fov: 62 }
const ZIP = { distance: 6, fov: 66 }
const SORTIE = { distance: 6, fov: 55 }
const PROBES: readonly [number, number, number][] = [
  [0, 1, 0], [1, 0.25, 0], [-1, 0.25, 0], [0, 0.35, 1], [0.7, 0.5, 0.7], [-0.7, 0.5, 0.7], [0, 0.2, -1],
]

function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

const smooth = (k: number) => k * k * (3 - 2 * k)
const PULL_IN = 9
const HOLD = 0.35
const NEAR_R = 0.14

export class HeroCamera {
  yaw = 0
  pitch = 12 * D2R
  closeness = 1
  private dist: number = CAMERA.indoor.distance
  private indoorK = 1
  private atriumK = 0
  private atriumGoal = 0
  private corridorK = 0
  private tightK = 0
  private side = 0
  private pivotBase = new THREE.Vector3()
  private pivotTmp = new THREE.Vector3()
  private styleK = { zip: 0, climb: 0 }
  private lookIdle = 10
  private recenterT = 0
  private recenterYaw = 0
  private pose: CameraPose | null = null
  private poseK = 0
  private pivot = new THREE.Vector3()
  private smoothFocus = new THREE.Vector3()
  private hasFocus = false
  private lead = new THREE.Vector3()
  private desired = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private right = new THREE.Vector3()
  private gameplayPos = new THREE.Vector3()
  private gameplayTarget = new THREE.Vector3()
  private ball: RAPIER.Ball | null = null
  private probeT = 0
  private holdT = 0
  private freeHit = false
  private fade: WallFade
  private filter: (c: RAPIER.Collider) => boolean

  constructor(private ctx: GameContext) {
    this.fade = new WallFade(ctx.scene, CAMERA.indoor.fadeOpacity)
    this.filter = (c) => {
      const t = ctx.physics.tagOf(c.handle)
      return !t || !EXCLUDE.includes(t.kind)
    }
  }

  setPose(p: CameraPose | null): void {
    this.pose = p
  }

  snapBehind(yaw: number): void {
    this.yaw = yaw
    this.pitch = 16 * D2R
    this.hasFocus = false
  }

  update(dt: number, f: CameraFrame): void {
    const ctx = this.ctx
    const cam = ctx.camera
    if (ctx.state.debug.cameraLocked) return
    const input = ctx.input
    const o = CAMERA.outside
    const i = CAMERA.indoor
    const lerp = THREE.MathUtils.lerp

    this.yaw += f.headingDelta
    this.indoorK = THREE.MathUtils.clamp(this.indoorK + (f.indoor ? 1 : -1) * dt / i.transitionSeconds, 0, 1)
    const k = smooth(this.indoorK)
    const zipGoal = f.style === 'zip' || f.style === 'slide' || f.style === 'glide' ? 1 : 0
    this.styleK.zip += (zipGoal - this.styleK.zip) * Math.min(1, dt * 2.2)
    const climbGoal = f.style === 'climb' || f.style === 'ladder' ? 1 : 0
    this.styleK.climb += (climbGoal - this.styleK.climb) * Math.min(1, dt * 3)

    if (!this.hasFocus || this.smoothFocus.distanceToSquared(f.focus) > 64) {
      this.smoothFocus.copy(f.focus)
      this.hasFocus = true
    } else {
      this.smoothFocus.x += (f.focus.x - this.smoothFocus.x) * Math.min(1, dt * 18)
      this.smoothFocus.z += (f.focus.z - this.smoothFocus.z) * Math.min(1, dt * 18)
      const vy = f.style === 'walk' ? 9 : 16
      this.smoothFocus.y += (f.focus.y - this.smoothFocus.y) * Math.min(1, dt * vy)
    }

    if (!f.freeze) {
      this.yaw += input.look.x
      this.pitch += input.look.y
    }
    const looked = Math.abs(input.look.x) + Math.abs(input.look.y) > 1e-4
    this.lookIdle = looked ? 0 : this.lookIdle + dt
    if (input.pressed('recenter')) {
      this.recenterT = 0.3
      this.recenterYaw = f.heroYaw
    }
    const travelYaw = Math.hypot(f.velocity.x, f.velocity.z) > 0.5 ? Math.atan2(f.velocity.x, -f.velocity.z) : f.heroYaw
    if (this.recenterT > 0) {
      this.recenterT -= dt
      const a = 1 - Math.exp(-14 * dt)
      this.yaw += angleDiff(this.yaw, this.recenterYaw) * a
      this.pitch = lerp(this.pitch, 12 * D2R, a)
    } else if (this.lookIdle > (this.styleK.climb > 0.5 ? 0.5 : 1.2)) {
      if (this.styleK.zip > 0.5) {
        this.yaw += angleDiff(this.yaw, travelYaw) * Math.min(1, dt * 2.2)
        this.pitch = lerp(this.pitch, 14 * D2R, Math.min(1, dt * 1.5))
      } else if (this.styleK.climb > 0.5) {
        this.yaw += angleDiff(this.yaw, f.heroYaw) * Math.min(1, dt * 0.9)
        this.pitch = lerp(this.pitch, -4 * D2R, Math.min(1, dt * 1.6))
      } else if (f.moving > 0.2 && this.lookIdle > o.recenterHoldSeconds * 0.6) {
        const d = angleDiff(this.yaw, travelYaw)
        const lateral = Math.abs(Math.sin(d))
        const corridor = 1 + this.corridorK * 2.5
        if (Math.abs(d) < 2.6) this.yaw += d * Math.min(1, dt * (0.3 + lateral * 0.9) * f.moving * corridor)
        this.pitch = lerp(this.pitch, (f.indoor ? 14 + this.tightK * 20 : 12) * D2R, Math.min(1, dt * (0.5 + this.tightK) * f.moving))
      }
    }
    const pMin = lerp(o.pitchMinDeg, i.pitchMinDeg, k) * D2R
    const pMax = lerp(o.pitchMaxDeg, i.pitchMaxDeg, k) * D2R
    this.pitch = THREE.MathUtils.clamp(this.pitch, pMin, pMax)

    const pivotH = lerp(o.pivotHeight, i.pivotHeight, k) - this.styleK.zip * 0.3
    this.lead.set(f.velocity.x, 0, f.velocity.z).multiplyScalar(0.07 * (1 - this.styleK.climb))
    if (this.lead.lengthSq() > 0.25) this.lead.setLength(0.5)
    this.pivot.set(this.smoothFocus.x + this.lead.x, this.smoothFocus.y + pivotH, this.smoothFocus.z + this.lead.z)

    this.probeOpenness(dt, f.indoor)
    this.atriumK += (this.atriumGoal - this.atriumK) * Math.min(1, dt * 0.8)
    const indoorDist = lerp(i.distance, ATRIUM.distance, smooth(this.atriumK)) * (1 - this.corridorK * 0.12)
    let want = lerp(SORTIE.distance, indoorDist, k)
    want = lerp(want, ZIP.distance, this.styleK.zip)
    want += this.styleK.climb * 0.6
    if (f.style === 'swim' && !f.indoor) want = SORTIE.distance + (f.fast ? 0.8 : 0)

    const cp = Math.cos(this.pitch)
    this.dir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp)
    const room = k > 0.5 && !this.pose ? this.collide(want, i.sphereRadius) : want
    const tightGoal = k > 0.5 && !this.pose ? 1 - THREE.MathUtils.clamp((room - 1.4) / 1.6, 0, 1) : 0
    this.tightK += (tightGoal - this.tightK) * Math.min(1, dt * (tightGoal > this.tightK ? 6 : 2))
    this.pivot.y += this.tightK * 0.22
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw))
    const sideGoal = this.sideClear(i.shoulderOffset * this.tightK)
    if (sideGoal * this.side < 0 || Math.abs(sideGoal) < Math.abs(this.side)) this.side = sideGoal
    else this.side += (sideGoal - this.side) * Math.min(1, dt * 5)
    this.pivot.addScaledVector(this.right, this.side)
    if (k > 0.5) {
      this.pivotBase.set(this.smoothFocus.x, f.focus.y + 0.9, this.smoothFocus.z)
      const head = this.pivotTmp.subVectors(this.pivot, this.pivotBase)
      const len = head.length()
      if (len > 1e-3) {
        head.divideScalar(len)
        const free = this.cast(this.pivotBase, head, len, i.sphereRadius)
        if (free < len) this.pivot.copy(this.pivotBase).addScaledVector(head, Math.max(0, free - 0.02))
      }
    }
    const allowed = this.collide(want, k > 0.5 ? i.sphereRadius : 0.35)
    const soft = k > 0.5 && !this.pose ? Math.min(allowed, this.whiskers(want, i.sphereRadius)) : allowed
    this.holdT = Math.max(0, this.holdT - dt)
    if (allowed < this.dist - 1e-3) {
      const glide = this.dist - PULL_IN * dt
      this.desired.copy(this.pivot).addScaledVector(this.dir, Math.max(allowed, glide))
      this.dist = glide > allowed && this.free(this.desired, NEAR_R) ? glide : allowed
      this.holdT = HOLD
    } else if (soft < this.dist) {
      this.dist += (soft - this.dist) * Math.min(1, dt * 7)
      this.holdT = HOLD
    } else if (this.holdT <= 0) {
      const out = Math.min((allowed - this.dist) * 2.5, lerp(o.easeOut, i.easeOut, k) * (1 + this.styleK.zip * 2))
      this.dist = Math.min(allowed, this.dist + out * dt)
    }

    this.desired.copy(this.pivot).addScaledVector(this.dir, this.dist)
    if (k < 0.5) {
      this.desired.y = Math.min(this.desired.y, CEILING_Y - 0.4)
    } else {
      const ceil = ceilingLocal(ctx, this.desired)
      if (ceil !== null) this.desired.y = Math.min(this.desired.y, ceil - i.ceilingMargin)
    }
    this.closeness = THREE.MathUtils.clamp((Math.min(this.desired.distanceTo(f.head), this.desired.distanceTo(f.chest)) - 0.6) / 0.8, 0, 1)

    this.gameplayPos.copy(this.desired)
    this.gameplayTarget.copy(this.pivot)
    let fov = lerp(f.fast ? o.fovFast : SORTIE.fov, lerp(i.fov, ATRIUM.fov, this.atriumK), k)
    fov = lerp(fov, ZIP.fov, this.styleK.zip)
    if (f.fast && k > 0.5) fov += 3
    fov += this.tightK * 5

    this.poseK = THREE.MathUtils.clamp(this.poseK + (this.pose ? dt : -dt) / 0.6, 0, 1)
    const pk = smooth(this.poseK)
    if (this.pose && pk > 0) {
      const p = this.pose
      cam.position.set(
        lerp(this.gameplayPos.x, p.position.x, pk), lerp(this.gameplayPos.y, p.position.y, pk),
        lerp(this.gameplayPos.z, p.position.z, pk),
      )
      cam.lookAt(
        lerp(this.gameplayTarget.x, p.target.x, pk), lerp(this.gameplayTarget.y, p.target.y, pk),
        lerp(this.gameplayTarget.z, p.target.z, pk),
      )
      this.setFov(lerp(fov, p.fov ?? fov, pk), dt)
    } else {
      cam.position.copy(this.gameplayPos)
      cam.lookAt(this.gameplayTarget)
      this.setFov(fov, dt)
    }
    this.fade.update(dt, cam.position, f.chest, f.head, k > 0.5 && !this.pose)
  }

  private setFov(fov: number, dt: number): void {
    const cam = this.ctx.camera
    const next = cam.fov + (fov - cam.fov) * Math.min(1, dt * 4)
    if (Math.abs(next - cam.fov) > 0.01) {
      cam.fov = next
      cam.updateProjectionMatrix()
    }
  }

  private cast(origin: THREE.Vector3, dir: THREE.Vector3, max: number, radius: number): number {
    const phys = this.ctx.physics
    const R = phys.rapier
    if (!this.ball || this.ball.radius !== radius) this.ball = new R.Ball(radius)
    const hit = phys.world.castShape(
      { x: origin.x, y: origin.y, z: origin.z }, { x: 0, y: 0, z: 0, w: 1 },
      { x: dir.x, y: dir.y, z: dir.z }, this.ball, 0, max, false,
      R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, this.filter,
    )
    return hit ? hit.time_of_impact : max
  }

  private free(p: THREE.Vector3, radius: number): boolean {
    const phys = this.ctx.physics
    const R = phys.rapier
    if (!this.nearBall || this.nearBall.radius !== radius) this.nearBall = new R.Ball(radius)
    this.freeHit = false
    phys.world.intersectionsWithShape(
      { x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, this.nearBall,
      () => {
        this.freeHit = true
        return false
      },
      R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, this.filter,
    )
    return !this.freeHit
  }
  private nearBall: RAPIER.Ball | null = null

  private collide(want: number, radius: number): number {
    const d = this.cast(this.pivot, this.dir, want, radius)
    return d < want ? Math.max(0.05, d - 0.02) : want
  }

  private whiskerDir = new THREE.Vector3()
  private whiskers(want: number, radius: number): number {
    let m = want
    const cp = Math.cos(this.pitch)
    for (const off of [-0.25, 0.25]) {
      const y = this.yaw + off
      this.whiskerDir.set(-Math.sin(y) * cp, Math.sin(this.pitch), Math.cos(y) * cp)
      const d = this.cast(this.pivot, this.whiskerDir, want, radius)
      m = Math.min(m, THREE.MathUtils.lerp(d, want, 0.5))
    }
    return m
  }

  private sideTmp = new THREE.Vector3()
  private sideClear(s: number): number {
    if (s < 0.01) return 0
    const r = this.cast(this.pivot, this.sideTmp.copy(this.right), s + 0.25, 0.2)
    if (r > s + 0.2) return s
    const l = this.cast(this.pivot, this.sideTmp.copy(this.right).negate(), s + 0.25, 0.2)
    if (l > s + 0.2) return -s
    return r >= l ? Math.max(0, r - 0.25) : -Math.max(0, l - 0.25)
  }

  private probeDir = new THREE.Vector3()
  private probeOpenness(dt: number, indoor: boolean): void {
    this.probeT -= dt
    if (this.probeT > 0) return
    this.probeT = 0.25
    if (!indoor) {
      this.atriumGoal = 0
      this.corridorK = 0
      return
    }
    const env = this.ctx.services.drift?.cameraEnv?.()
    let sum = 0
    let sideMin = 99
    const cy = Math.cos(this.yaw)
    const sy = Math.sin(this.yaw)
    for (let n = 0; n < PROBES.length; n++) {
      const p = PROBES[n]!
      this.probeDir.set(p[0] * cy - p[2] * sy, p[1], p[0] * sy + p[2] * cy).normalize()
      const d = this.cast(this.pivot, this.probeDir, 24, 0.2)
      sum += d
      if (n === 1 || n === 2) sideMin = Math.min(sideMin, d)
    }
    const open = sum / PROBES.length
    const probe = THREE.MathUtils.clamp((open - 6) / 9, 0, 1)
    this.atriumGoal = Math.max(probe, env && env.indoor > 0.5 ? env.airHaze * 0.85 : 0)
    const corridor = THREE.MathUtils.clamp((2.6 - sideMin) / 1.6, 0, 1) * (1 - probe)
    this.corridorK += (corridor - this.corridorK) * 0.5
  }

  dispose(): void {
    this.fade.dispose()
  }
}
