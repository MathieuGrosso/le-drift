import * as THREE from 'three'
import { TETHER } from '../core/layout'
import { INDOOR } from '../core/tuning'
import type { GameContext, HeroService, QualityLevel, System, Vec3 } from '../core/types'
import type { HeroAnchor } from './anchors'
import { Animator, type AnimParams, type ClipId, type GestureClip } from './anim'
import { HeroCamera } from './camera'
import { HeroController } from './controller'
import { Fader, Footprints, Particles } from './fx'
import { Longe } from './longe'
import { buildHero, type HeroModel } from './model'
import { Scarf } from './scarf'
import { Secondary } from './secondary'
import { createHeroMaterials, type HeroMaterials } from './shading'

export type { HeroAnchor } from './anchors'
export type { GestureClip } from './anim'

export interface HeroServiceExt extends HeroService {
  zip(lineId: string): boolean
  slide(slideId: string): boolean
  tube(toLocal: Vec3, yaw: number): Promise<void>
  carry(object: THREE.Object3D | null): void
  drop(): { object: THREE.Object3D; velocity: Vec3 } | null
  gesture(clip: GestureClip, seconds?: number): void
  clipRing(ringId: string): boolean
  reelIn(): Promise<void>
  setAnchors(source: string, anchors: HeroAnchor[] | null): void
  activity(): string
}

const PRINTS: Record<QualityLevel, number> = { high: 64, medium: 48, low: 24 }
const UPRIGHT: ReadonlySet<ClipId> = new Set<ClipId>([
  'idle-dry', 'idle-floor', 'talk', 'walk-dry', 'walk', 'sit', 'lean', 'exhausted', 'carry-idle', 'carry-walk', 'hand-on-glass',
])

export function createHeroSystem(): System {
  let model: HeroModel | null = null
  let mats: HeroMaterials | null = null
  let ctrl: HeroController | null = null
  let cam: HeroCamera | null = null
  let anim: Animator | null = null
  let scarf: Scarf | null = null
  let second: Secondary | null = null
  let prints: Footprints | null = null
  let drops: Particles | null = null
  let fader: Fader | null = null
  let longe: Longe | null = null
  let carried: THREE.Object3D | null = null
  const unsubs: (() => void)[] = []
  const params: AnimParams = {
    t: 0, phase: 0, clipTime: 0, speed: 0, bank: 0, pitch: 0, climbX: 0, climbY: 0, wet: 0, exhausted: false, inWater: false, swing: 0,
  }
  const v = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const right = new THREE.Vector3()
  const flow = new THREE.Vector3()
  const chestW = new THREE.Vector3()
  const hipsW = new THREE.Vector3()
  const headW = new THREE.Vector3()
  const thighLW = new THREE.Vector3()
  const thighRW = new THREE.Vector3()
  const clipW = new THREE.Vector3()
  const colliders = [
    { c: chestW, r: 0.2 }, { c: hipsW, r: 0.18 }, { c: headW, r: 0.16 }, { c: thighLW, r: 0.1 }, { c: thighRW, r: 0.1 },
  ]
  const qYaw = new THREE.Quaternion()
  const qLean = new THREE.Quaternion()
  const leanAxis = new THREE.Vector3()
  const lastDrift = new THREE.Vector3()
  const driftNow = new THREE.Vector3()
  const driftDelta = new THREE.Vector3()
  let lastHeading = 0
  let hasFrame = false
  const carryVel = new THREE.Vector3()
  const lastHold = new THREE.Vector3()
  let hasLastDrift = false
  let dripAcc = 0
  let bubbleT = 2

  const onBack = (m: HeroModel) => {
    m.bones.chest.add(m.scrubber)
    m.scrubber.position.set(0.02, 0.0, 0.17)
    m.scrubber.rotation.set(0.1, 0, 0.65)
  }
  const inHand = (m: HeroModel) => {
    m.bones.handR.add(m.scrubber)
    m.scrubber.position.set(0, -0.07, 0)
    m.scrubber.rotation.set(Math.PI, 0, 0)
  }
  const poulieOnBelt = (m: HeroModel) => {
    m.bones.hips.add(m.poulie)
    m.poulie.position.set(0.17, 0.02, 0.05)
    m.poulie.rotation.set(0, Math.PI / 2, 0.2)
  }
  const poulieInHand = (m: HeroModel) => {
    m.bones.handR.add(m.poulie)
    m.poulie.position.set(0, -0.02, 0)
    m.poulie.rotation.set(0, Math.PI / 2, Math.PI)
  }

  const placeRoot = () => {
    if (!model || !ctrl) return
    model.root.position.copy(ctrl.pos)
    qYaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -ctrl.yaw)
    const angle = ctrl.out.lean.length()
    if (angle > 1e-4) {
      leanAxis.copy(ctrl.out.lean).divideScalar(angle)
      qLean.setFromAxisAngle(leanAxis, angle)
      model.root.quaternion.multiplyQuaternions(qLean, qYaw)
    } else model.root.quaternion.copy(qYaw)
  }

  const headLook = (e: THREE.Euler) => {
    if (!ctrl || !model || !anim) return
    if (!UPRIGHT.has(anim.current)) return
    const target = ctrl.out.lookAt
    let dx: number, dy: number, dz: number
    model.bones.head.getWorldPosition(v)
    if (target) {
      dx = target.x - v.x
      dy = target.y + 1.5 - v.y
      dz = target.z - v.z
    } else {
      if (ctrl.out.moving > 0.1) return
      const cp = Math.cos(cam?.pitch ?? 0)
      const yaw = cam?.yaw ?? ctrl.yaw
      dx = Math.sin(yaw) * cp
      dy = -Math.sin(cam?.pitch ?? 0) * 0.5
      dz = -Math.cos(yaw) * cp
    }
    let rel = Math.atan2(dx, -dz) - ctrl.yaw
    rel = Math.atan2(Math.sin(rel), Math.cos(rel))
    if (!target && Math.abs(rel) > 1.9) return
    const pitch = Math.atan2(dy, Math.hypot(dx, dz))
    e.set(THREE.MathUtils.clamp(pitch, -0.4, 0.45) * 0.7, -THREE.MathUtils.clamp(rel, -0.9, 0.9) * (target ? 0.8 : 0.45), 0)
  }

  let ctx0: GameContext | null = null
  const service: HeroServiceExt = {
    teleport(p, yaw) {
      ctrl?.teleport(p, yaw)
      if (model && ctrl) {
        placeRoot()
        model.root.updateMatrixWorld(true)
        scarf?.reset(model.scarfAnchor.getWorldPosition(v))
      }
      second?.reset()
      hasFrame = false
      prints?.clear()
      drops?.clear()
      longe?.hide()
      hasLastDrift = false
      if (cam && ctrl) cam.snapBehind(ctrl.yaw)
    },
    teleportLocal(local, yaw) {
      const drift = ctx0?.services.drift
      if (!drift) return
      const heading = drift.pose().heading
      service.teleport(drift.toWorld(local), yaw === undefined ? undefined : yaw + heading)
    },
    setMode(m) {
      ctrl?.setMode(m)
    },
    setCameraPose(pose) {
      cam?.setPose(pose)
    },
    headPosition() {
      if (!model) return { x: 0, y: 0, z: 0 }
      model.bones.head.getWorldPosition(v)
      return { x: v.x, y: v.y + 0.12, z: v.z }
    },
    sit(seatId) {
      ctrl?.sit(seatId)
    },
    lean(target) {
      ctrl?.lean(target)
    },
    stand() {
      ctrl?.stand()
    },
    zip: (id) => ctrl?.zip(id) ?? false,
    slide: (id) => ctrl?.slide(id) ?? false,
    tube: (toLocal, yaw) => ctrl?.tube(toLocal, yaw) ?? Promise.resolve(),
    carry(object) {
      if (!model || !ctrl) return
      if (carried && carried !== object) service.drop()
      if (!object) return
      carried = object
      model.hold.add(object)
      object.position.set(0, 0, 0)
      object.rotation.set(0, 0, 0)
      ctrl.setCarrying(true)
    },
    drop() {
      if (!carried || !ctrl || !ctx0) return null
      const o = carried
      carried = null
      ctx0.scene.attach(o)
      ctrl.setCarrying(false)
      return { object: o, velocity: { x: carryVel.x, y: carryVel.y, z: carryVel.z } }
    },
    gesture: (clip, seconds = 1.2) => ctrl?.gesture(clip, seconds),
    clipRing: (id) => ctrl?.clipRing(id) ?? false,
    reelIn: () => ctrl?.reelIn() ?? Promise.resolve(),
    setAnchors: (source, anchors) => ctrl?.anchors.set(source, anchors),
    activity: () => ctrl?.state ?? 'none',
  }

  return {
    id: 'hero',
    init(ctx: GameContext) {
      mats = createHeroMaterials(ctx)
      model = buildHero(mats)
      onBack(model)
      poulieOnBelt(model)
      ctx0 = ctx
      ctx.scene.add(model.root)
      longe = new Longe(ctx)
      ctx.scene.add(longe.mesh)
      scarf = new Scarf(mats.cloth)
      ctx.scene.add(scarf.mesh)
      second = new Secondary(model)
      prints = new Footprints(PRINTS.high)
      prints.setCapacity(PRINTS[ctx.quality.level])
      ctx.scene.add(prints.mesh)
      drops = new Particles(56)
      ctx.scene.add(drops.points)
      fader = new Fader(ctx.uiRoot)
      ctrl = new HeroController(ctx)
      const f = fader
      ctrl.setFader((mid) => f.through(mid, 450))
      ctrl.loadFromState()
      cam = new HeroCamera(ctx)
      cam.snapBehind(ctrl.yaw)
      anim = new Animator(model)
      const shadows = (on: boolean) => {
        if (!model || !scarf) return
        model.mesh.castShadow = on
        model.scrubber.castShadow = on
        model.voile.castShadow = on
        model.poulie.castShadow = on
        scarf.mesh.castShadow = on
      }
      shadows(ctx.quality.shadows)
      unsubs.push(ctx.quality.onChange((q) => {
        prints?.setCapacity(PRINTS[q.level])
        shadows(q.shadows)
      }))

      const c = ctrl
      const m = model
      c.onStep((left) => {
        if (!prints || c.medium !== 'air' || c.wetness <= 0.1) return
        m.bones[left ? 'footL' : 'footR'].getWorldPosition(v2)
        v2.y = c.pos.y
        prints.stamp(v2, c.groundNormal, c.yaw, left, c.wetness, ctx.clock.elapsed)
      })

      placeRoot()
      model.root.updateMatrixWorld(true)
      scarf.reset(model.scarfAnchor.getWorldPosition(v))
      ctx.services.hero = service
      if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __hero?: HeroServiceExt }).__hero = service
    },

    update(dt, ctx) {
      if (!ctrl || !model || !anim || !cam || !mats) return
      ctrl.update(dt, cam.yaw, cam.pitch)
      const out = ctrl.out
      placeRoot()

      params.t = ctx.clock.elapsed
      params.phase = out.phase
      params.speed = out.speed
      params.bank = out.bank
      params.pitch = out.pitch
      params.climbX = out.climbX
      params.climbY = out.climbY
      params.swing = out.swing
      params.wet = ctrl.wetness
      params.exhausted = ctx.state.hero.exhausted
      params.inWater = out.inWater
      anim.play(out.clip, ctx.clock.elapsed, out.clipFade)
      anim.update(dt, params, headLook)

      model.voile.visible = out.gliding
      if (out.gliding) model.voile.rotation.set(-0.35 + out.pitch * 0.2, 0, -out.bank * 0.3)
      const wantHand = out.scrubbing
      if (wantHand && model.scrubber.parent !== model.bones.handR) inHand(model)
      else if (!wantHand && model.scrubber.parent !== model.bones.chest) onBack(model)
      const owned = ctx.services.gameplay?.hasItem('poulie') ?? true
      model.poulie.visible = owned || out.zipping
      if (out.zipping && model.poulie.parent !== model.bones.handR) poulieInHand(model)
      else if (!out.zipping && model.poulie.parent !== model.bones.hips) poulieOnBelt(model)

      mats.wet.value = out.inWater ? 0 : THREE.MathUtils.clamp(ctrl.wetness * 0.9, 0, 0.6)
    },

    lateUpdate(dt, ctx) {
      if (!ctrl || !model || !cam || !scarf || !mats || !prints || !drops || !longe) return
      model.root.updateMatrixWorld(true)

      const inWater = ctrl.medium === 'water'
      const yaw = ctrl.yaw
      right.set(Math.cos(yaw), 0, Math.sin(yaw))
      if (inWater) {
        const c = ctx.services.world?.currentAt(ctrl.pos) ?? ctx.state.env.current
        flow.set(c.x, c.y, c.z)
      } else flow.set(0, 0, 0)
      model.bones.chest.getWorldPosition(chestW)
      model.bones.hips.getWorldPosition(hipsW)
      model.bones.head.getWorldPosition(headW)
      model.bones.thighL.getWorldPosition(thighLW)
      model.bones.thighR.getWorldPosition(thighRW)
      chestW.y += 0.05
      headW.y += 0.1
      thighLW.y -= 0.2
      thighRW.y -= 0.2
      const driftSvc = ctx.services.drift
      if (driftSvc) {
        const dp = driftSvc.pose()
        driftNow.set(dp.position.x, dp.position.y, dp.position.z)
        if (hasFrame && !inWater) {
          driftDelta.subVectors(driftNow, lastDrift)
          const turn = dp.heading - lastHeading
          if (driftDelta.lengthSq() < 4 && Math.abs(turn) < 0.2) {
            scarf.carry(driftDelta, turn, lastDrift)
            second?.carry(driftDelta, turn, lastDrift)
          }
        }
        lastHeading = dp.heading
      }
      second?.update(dt, ctrl.gravity, {
        lids: anim?.current === 'sleep' || anim?.current === 'lie-down' ? 1 : ctx.state.hero.exhausted || anim?.current === 'exhausted' ? 0.45 : anim?.current === 'eat' ? 0.25 : 0,
        inWater, flow,
      })
      scarf.update(dt, {
        anchor: model.scarfAnchor.getWorldPosition(v),
        right, flow, inWater, wetness: ctrl.wetness, t: ctx.clock.elapsed, colliders,
        floorY: ctrl.grounded ? ctrl.pos.y : -1e4,
        gravity: ctrl.gravity,
      })

      if (carried) {
        model.hold.getWorldPosition(v2)
        carryVel.subVectors(v2, lastHold).divideScalar(Math.max(dt, 1e-4))
        lastHold.copy(v2)
      }

      if (driftSvc && !inWater) {
        if (hasLastDrift) prints.shift(driftNow.x - lastDrift.x, driftNow.y - lastDrift.y, driftNow.z - lastDrift.z)
        hasLastDrift = true
      } else hasLastDrift = false
      if (driftSvc) {
        lastDrift.copy(driftNow)
        hasFrame = true
      }
      prints.update(ctx.clock.elapsed, ctrl.wetness, INDOOR.wetnessDrySeconds)

      if (!inWater && ctrl.wetness > 0.02) {
        dripAcc += dt * ctrl.wetness * 16
        while (dripAcc >= 1) {
          dripAcc -= 1
          const src = Math.random() < 0.55 ? scarf.point(4 + Math.floor(Math.random() * 9)) : model.hairAnchor.getWorldPosition(v2)
          v.set((Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3)
          drops.emit(src, v, 1.2, 0.035 + Math.random() * 0.02)
        }
      } else dripAcc = 0
      if (inWater) {
        bubbleT -= dt
        const hard = ctrl.out.sprinting
        if (bubbleT <= 0) {
          bubbleT = hard ? 0.8 + Math.random() : 2.5 + Math.random() * 3
          const head = service.headPosition()
          const n = 2 + Math.floor(Math.random() * 3)
          for (let i = 0; i < n; i++) {
            v2.set(head.x + right.x * 0.02, head.y - 0.12, head.z + right.z * 0.02)
            v.set((Math.random() - 0.5) * 0.25, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25)
            drops.emit(v2, v, 3 + Math.random() * 2, 0.04 + Math.random() * 0.05)
          }
        }
      }
      drops.update(dt, inWater, ctrl.pos.y)

      if (inWater && ctx.state.mode === 'sortie' && ctrl.tetherActive) {
        model.clip.getWorldPosition(clipW)
        longe.update(dt, ctrl.tetherAnchor, clipW, TETHER.length, flow)
      } else longe.hide()

      const out = ctrl.out
      cam.update(dt, {
        focus: ctrl.pos,
        chest: chestW,
        head: headW,
        velocity: ctrl.vel,
        heroYaw: yaw,
        moving: out.moving,
        indoor: !inWater,
        style: out.style,
        fast: out.sprinting || out.speed > 6,
        freeze: out.freezeCamera,
        headingDelta: ctrl.headingDelta,
      })
      mats.fade.value = ctx.state.debug.cameraLocked ? 1 : 0.15 + 0.85 * cam.closeness
    },

    dispose() {
      for (const u of unsubs) u()
      unsubs.length = 0
      ctrl?.dispose()
      ctrl = null
      cam?.dispose()
      fader?.dispose()
      if (model) {
        model.root.removeFromParent()
        model.mesh.geometry.dispose()
        model.scrubber.geometry.dispose()
        model.voile.geometry.dispose()
        model.poulie.geometry.dispose()
        model.eyes.geometry.dispose()
        model.tuft.geometry.dispose()
      }
      longe?.dispose()
      scarf?.mesh.removeFromParent()
      scarf?.mesh.geometry.dispose()
      prints?.mesh.removeFromParent()
      prints?.mesh.dispose()
      drops?.points.removeFromParent()
      drops?.points.geometry.dispose()
      mats?.body.dispose()
      mats?.cloth.dispose()
    },
  }
}
