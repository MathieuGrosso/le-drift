import * as THREE from 'three'
import { TETHER } from '../core/layout'
import { INDOOR } from '../core/tuning'
import { PLACES } from '../core/layout'
import type { DebugPose, GameContext, HeroService, QualityLevel, System, Vec3 } from '../core/types'
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
  const brushW = new THREE.Vector3()
  const handleW = new THREE.Vector3()
  const colliders = [
    { c: chestW, r: 0.17 }, { c: hipsW, r: 0.215 }, { c: headW, r: 0.17 }, { c: thighLW, r: 0.11 }, { c: thighRW, r: 0.11 },
    { c: brushW, r: 0.11 }, { c: handleW, r: 0.05 },
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
    m.scrubber.position.set(-0.01, -0.1, 0.2)
    m.scrubber.rotation.set(-0.2, 0, Math.PI - 0.62)
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
  let portrait = false
  const keyLocal = new THREE.Vector3()
  const keyWant = new THREE.Vector4()
  const lightGlass = (ctx: GameContext, dt: number) => {
    if (!mats) return
    const drift = ctx.services.drift
    const room = ctx.state.hero.room
    keyWant.set(0, 0, 0, 0)
    let fill = 0
    if (portrait && !ctx.state.debug.cameraLocked) portrait = false
    if (drift && ctrl?.medium === 'air' && (room === 'refectoire' || room === 'rebord')) {
      const h = ctx.state.time.hours
      const day = THREE.MathUtils.smoothstep(h, 5.5, 7) * (1 - THREE.MathUtils.smoothstep(h, 19, 20.5))
      keyLocal.set(portrait ? 1 : 0, portrait ? 0.4 : 0.25, portrait ? 0.3 : 1).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, -drift.pose().heading)
      keyWant.set(keyLocal.x, keyLocal.y, keyLocal.z, (portrait ? 0.8 : 0.38) * (0.3 + 0.7 * day))
      fill = portrait ? 0.16 : 0
    }
    const k = portrait ? 1 : 1 - Math.exp(-dt * 2)
    mats.key.value.lerp(keyWant, k)
    if (keyWant.w > 0) mats.key.value.set(keyWant.x, keyWant.y, keyWant.z, mats.key.value.w)
    if (ctrl?.medium === 'air') fill = Math.max(fill, 0.07)
    const fv = mats.fill.value
    const camObj = ctx.camera
    const tmpF = v2.setFromMatrixColumn(camObj.matrixWorld, 0).multiplyScalar(0.6)
    camObj.getWorldDirection(v).multiplyScalar(-0.75)
    tmpF.add(v)
    tmpF.y += 0.35
    tmpF.normalize()
    fv.set(tmpF.x, tmpF.y, tmpF.z, fv.w + (fill - fv.w) * k)
    focusVeil(ctx)
  }
  let veil: THREE.Mesh | null = null
  const focusVeil = (ctx: GameContext) => {
    if (!portrait || !ctrl) {
      veil?.removeFromParent()
      return
    }
    if (!veil) {
      veil = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 4),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.42, ior: 1.5, thickness: 0, metalness: 0, specularIntensity: 0, transparent: false }),
      )
      veil.name = 'hero-portrait-focus'
      veil.renderOrder = 10
    }
    if (!veil.parent) ctx.scene.add(veil)
    const camObj = ctx.camera
    camObj.getWorldDirection(v)
    v.y = 0
    v.normalize()
    veil.position.set(ctrl.pos.x + v.x * 0.75, ctrl.pos.y + 1.4, ctrl.pos.z + v.z * 0.75)
    veil.lookAt(camObj.position.x, veil.position.y, camObj.position.z)
  }
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
      ctrl.setTeleporter((p, yaw) => service.teleport(p, yaw))
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
      registerPortrait(ctx)
      unsubs.push(ctx.bus.on('debug:pose', ({ name }) => {
        portrait = name === 'art-ilo'
      }))
      if (new URLSearchParams(location.search).has('debug')) Object.assign(window as unknown as Record<string, unknown>, { __hero: service, __heroCtrl: ctrl, __heroCam: cam })
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
      chestW.y += 0.06
      hipsW.y -= 0.1
      headW.y += 0.1
      if (model.scrubber.parent === model.bones.chest) {
        model.scrubber.localToWorld(brushW.set(0, 0.46, 0.05))
        model.scrubber.localToWorld(handleW.set(0, 0.05, 0.03))
      } else {
        brushW.set(0, -1e4, 0)
        handleW.set(0, -1e4, 0)
      }
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
      lightGlass(ctx, dt)
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
      veil?.removeFromParent()
      veil?.geometry.dispose()
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

const PORTRAIT_AT = { x: 18.75, y: 0, z: 68.3 }
const PORTRAIT_YAW = 0.55
const PORTRAIT_CAM_YAW = -0.24

function registerPortrait(ctx: GameContext): void {
  const reg = ctx.services.debug as typeof ctx.services.debug & { registerFactory?: (name: string, f: (c: GameContext) => DebugPose) => void }
  for (const [name, around] of [['ilo-face', 0], ['ilo-dos', Math.PI], ['ilo-34', 0.8]] as const) {
    reg.registerFactory?.(name, (c) => {
      const drift = c.services.drift
      if (!drift) return { hour: 8, camera: { position: { x: 0, y: 1.4, z: -3 }, target: { x: 0, y: 0.9, z: 0 }, fov: 35 } }
      const st = c.state.hero
      const place = PLACES['grande-vitre']!
      st.medium = 'air'
      st.room = place.room ?? 'refectoire'
      st.district = place.district
      st.localPosition = { ...PORTRAIT_AT }
      const a = PORTRAIT_YAW + around
      return {
        hour: 8,
        hero: { position: drift.toWorld(PORTRAIT_AT), yaw: PORTRAIT_YAW + drift.pose().heading },
        camera: {
          position: drift.toWorld({ x: PORTRAIT_AT.x + Math.sin(a) * 4.3, y: 1.3, z: PORTRAIT_AT.z - Math.cos(a) * 4.3 }),
          target: drift.toWorld({ x: PORTRAIT_AT.x, y: 0.88, z: PORTRAIT_AT.z }),
          fov: 35,
        },
      }
    })
  }
  reg.registerFactory?.('art-ilo', (c) => {
    const drift = c.services.drift
    const st = c.state.hero
    if (!drift) {
      const p = st.position
      return { hour: 8, camera: { position: { x: p.x, y: p.y + 1.6, z: p.z - 1.4 }, target: { x: p.x, y: p.y + 1.45, z: p.z }, fov: 30 } }
    }
    const place = PLACES['grande-vitre']!
    st.medium = 'air'
    st.room = place.room ?? 'refectoire'
    st.district = place.district
    st.localPosition = { ...PORTRAIT_AT }
    const heading = drift.pose().heading
    const cy = PORTRAIT_CAM_YAW
    return {
      hour: 8,
      hero: { position: drift.toWorld(PORTRAIT_AT), yaw: PORTRAIT_YAW + heading },
      camera: {
        position: drift.toWorld({ x: PORTRAIT_AT.x + Math.sin(cy) * 1.5, y: 1.47, z: PORTRAIT_AT.z - Math.cos(cy) * 1.5 }),
        target: drift.toWorld({ x: PORTRAIT_AT.x + 0.2, y: 1.47, z: PORTRAIT_AT.z }),
        fov: 30,
      },
    }
  })
}
