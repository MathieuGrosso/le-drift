import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import { CAMERA } from '../core/tuning'
import type { CameraPose, GameContext } from '../core/types'

const D2R = Math.PI / 180

export interface CameraFrame {
  focus: THREE.Vector3
  heroYaw: number
  moving: number
  indoor: boolean
  wide: boolean
  fast: boolean
  climbing: boolean
  freeze: boolean
}

function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export class HeroCamera {
  yaw = 0
  pitch = 12 * D2R
  private dist: number = CAMERA.outside.distance
  private indoorK = 0
  private lookIdle = 10
  private recenterT = 0
  private recenterYaw = 0
  private pose: CameraPose | null = null
  private poseK = 0
  private pivot = new THREE.Vector3()
  private desired = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private gameplayPos = new THREE.Vector3()
  private gameplayTarget = new THREE.Vector3()
  private ball: InstanceType<GameContext['physics']['rapier']['Ball']> | null = null
  private fadeables: THREE.Object3D[] = []
  private fadeScan = 0
  private ray = new THREE.Raycaster()
  private hits: THREE.Intersection[] = []
  closeness = 1

  constructor(private ctx: GameContext) {}

  setPose(p: CameraPose | null): void {
    this.pose = p
  }

  snapBehind(yaw: number): void {
    this.yaw = yaw
    this.pitch = 12 * D2R
  }

  update(dt: number, f: CameraFrame): void {
    const ctx = this.ctx
    const cam = ctx.camera
    if (ctx.state.debug.cameraLocked) return
    const input = ctx.input
    const o = CAMERA.outside
    const i = CAMERA.indoor

    this.indoorK = THREE.MathUtils.clamp(this.indoorK + (f.indoor ? 1 : -1) * dt / i.transitionSeconds, 0, 1)
    const k = this.indoorK * this.indoorK * (3 - 2 * this.indoorK)
    const lerp = THREE.MathUtils.lerp

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
    if (this.recenterT > 0) {
      this.recenterT -= dt
      const a = 1 - Math.exp(-14 * dt)
      this.yaw += angleDiff(this.yaw, this.recenterYaw) * a
      this.pitch = lerp(this.pitch, 12 * D2R, a)
    } else if (!f.climbing && this.lookIdle > o.recenterHoldSeconds && f.moving > 0.2) {
      const d = angleDiff(this.yaw, f.heroYaw)
      const lateral = Math.abs(Math.sin(d))
      this.yaw += d * Math.min(1, dt * (0.35 + lateral * 0.9) * f.moving)
      this.pitch = lerp(this.pitch, (f.indoor ? 8 : 12) * D2R, Math.min(1, dt * 0.4 * f.moving))
    }
    const pMin = lerp(o.pitchMinDeg, i.pitchMinDeg, k) * D2R
    const pMax = lerp(o.pitchMaxDeg, i.pitchMaxDeg, k) * D2R
    this.pitch = THREE.MathUtils.clamp(this.pitch, pMin, pMax)

    const outDist = f.wide ? o.distanceGlide : f.climbing ? o.distanceNearWall : o.distance
    const target = lerp(outDist, i.distance, k)
    const pivotH = lerp(o.pivotHeight, i.pivotHeight, k)
    this.pivot.set(f.focus.x, f.focus.y + pivotH, f.focus.z)

    const cp = Math.cos(this.pitch)
    this.dir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp)
    const allowed = this.collide(target, k)
    if (allowed < this.dist) this.dist = allowed
    else this.dist = Math.min(allowed, this.dist + lerp(o.easeOut, i.easeOut, k) * dt * (f.wide ? 3 : 1))

    this.desired.copy(this.pivot).addScaledVector(this.dir, this.dist)
    if (this.dist < i.distanceMin && k > 0.5) {
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw))
      this.desired.addScaledVector(right, i.shoulderOffset * (1 - this.dist / i.distanceMin))
    }
    if (k < 0.5) {
      const ground = ctx.services.world?.heightAt(this.desired.x, this.desired.z)
      if (ground !== undefined) this.desired.y = Math.max(this.desired.y, ground + 0.5)
      this.desired.y = Math.min(this.desired.y, CEILING_Y - 0.4)
    } else {
      const ceil = ctx.services.drift?.roomCeilingAt(this.desired)
      if (ceil !== null && ceil !== undefined) this.desired.y = Math.min(this.desired.y, ceil - i.ceilingMargin)
    }
    this.closeness = THREE.MathUtils.clamp((this.desired.distanceTo(this.pivot) - 0.35) / 0.5, 0, 1)

    this.gameplayPos.copy(this.desired)
    this.gameplayTarget.copy(this.pivot)
    const fov = lerp(f.fast || f.wide ? o.fovFast : o.fov, i.fov, k)

    this.poseK = THREE.MathUtils.clamp(this.poseK + (this.pose ? dt : -dt) / 0.6, 0, 1)
    const pk = this.poseK * this.poseK * (3 - 2 * this.poseK)
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
    this.updateFadeables(dt, k > 0.5)
  }

  private setFov(fov: number, dt: number): void {
    const cam = this.ctx.camera
    const next = cam.fov + (fov - cam.fov) * Math.min(1, dt * 4)
    if (Math.abs(next - cam.fov) > 0.01) {
      cam.fov = next
      cam.updateProjectionMatrix()
    }
  }

  private collide(want: number, indoorK: number): number {
    const phys = this.ctx.physics
    const p = this.pivot
    const exclude = ['trigger', 'fauna', 'kelp', 'window'] as const
    if (indoorK > 0.5) {
      const R = phys.rapier
      if (!this.ball) this.ball = new R.Ball(CAMERA.indoor.sphereRadius)
      const hit = phys.world.castShape(
        { x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 },
        { x: this.dir.x, y: this.dir.y, z: this.dir.z }, this.ball, 0, want, true,
        R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined,
        (c) => {
          const t = phys.tagOf(c.handle)
          return !t || !(exclude as readonly string[]).includes(t.kind)
        },
      )
      return hit ? Math.max(0.05, hit.time_of_impact) : want
    }
    const hit = phys.raycast(p, this.dir, want + 0.3, { excludeKinds: [...exclude] })
    return hit ? Math.max(0.3, hit.distance - 0.3) : want
  }

  private updateFadeables(dt: number, indoor: boolean): void {
    this.fadeScan -= dt
    if (indoor && this.fadeScan <= 0) {
      this.fadeScan = 0.5
      this.fadeables.length = 0
      this.ctx.scene.traverseVisible((o) => {
        if (o.userData.fadeable) this.fadeables.push(o)
      })
    }
    if (this.fadeables.length === 0) return
    const cam = this.ctx.camera
    const toPivot = this.dir.clone().negate()
    const len = cam.position.distanceTo(this.pivot)
    this.ray.set(cam.position, toPivot)
    this.ray.far = len
    for (const o of this.fadeables) {
      this.hits.length = 0
      const blocking = indoor && this.ray.intersectObject(o, true, this.hits).length > 0
      const cur = typeof o.userData.cameraFade === 'number' ? (o.userData.cameraFade as number) : 1
      const goal = blocking ? CAMERA.indoor.fadeOpacity : 1
      o.userData.cameraFade = cur + (goal - cur) * Math.min(1, dt * 8)
    }
    if (!indoor) this.fadeables.length = 0
  }
}
