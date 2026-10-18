import * as THREE from 'three'
import { INDOOR } from '../core/tuning'
import type { GameContext, HeroService, QualityLevel, System } from '../core/types'
import { Animator, type AnimParams } from './anim'
import { HeroCamera } from './camera'
import { HeroController } from './controller'
import { Fader, Footprints, Particles } from './fx'
import { buildHero, type HeroModel } from './model'
import { Scarf } from './scarf'
import { createHeroMaterials, type HeroMaterials } from './shading'

const PRINTS: Record<QualityLevel, number> = { high: 64, medium: 48, low: 24 }
const UPRIGHT = new Set(['idle-dry', 'idle-floor', 'talk', 'walk-dry', 'walk', 'sit', 'lean', 'exhausted'])

export function createHeroSystem(): System {
  let model: HeroModel | null = null
  let mats: HeroMaterials | null = null
  let ctrl: HeroController | null = null
  let cam: HeroCamera | null = null
  let anim: Animator | null = null
  let scarf: Scarf | null = null
  let prints: Footprints | null = null
  let drops: Particles | null = null
  let fader: Fader | null = null
  const unsubs: (() => void)[] = []
  const params: AnimParams = {
    t: 0, phase: 0, clipTime: 0, speed: 0, bank: 0, pitch: 0, climbX: 0, climbY: 0, wet: 0, exhausted: false, inWater: true,
  }
  const v = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const right = new THREE.Vector3()
  const flow = new THREE.Vector3()
  const chestW = new THREE.Vector3()
  const hipsW = new THREE.Vector3()
  const colliders = [{ c: chestW, r: 0.21 }, { c: hipsW, r: 0.19 }]
  const lastDrift = new THREE.Vector3()
  let hasLastDrift = false
  let dripAcc = 0
  let bubbleT = 2
  let lastKick = 0

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

  const service: HeroService = {
    teleport(p, yaw) {
      ctrl?.teleport(p, yaw)
      if (model && ctrl) {
        model.root.position.copy(ctrl.pos)
        model.root.rotation.y = -ctrl.yaw
        model.root.updateMatrixWorld(true)
        scarf?.reset(model.scarfAnchor.getWorldPosition(v))
      }
      prints?.clear()
      drops?.clear()
      hasLastDrift = false
      if (cam && ctrl) cam.snapBehind(ctrl.yaw)
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
  }

  return {
    id: 'hero',
    init(ctx: GameContext) {
      mats = createHeroMaterials(ctx)
      model = buildHero(mats)
      onBack(model)
      ctx.scene.add(model.root)
      scarf = new Scarf(mats.cloth)
      ctx.scene.add(scarf.mesh)
      prints = new Footprints(PRINTS.high)
      prints.setCapacity(PRINTS[ctx.quality.level])
      ctx.scene.add(prints.mesh)
      drops = new Particles(56)
      ctx.scene.add(drops.points)
      fader = new Fader(ctx.uiRoot)
      ctrl = new HeroController(ctx)
      const f = fader
      ctrl.setFader((mid) => f.through(mid, 500))
      ctrl.loadFromState()
      cam = new HeroCamera(ctx)
      cam.snapBehind(ctrl.yaw)
      anim = new Animator(model)
      const shadows = (on: boolean) => {
        if (!model || !scarf) return
        model.mesh.castShadow = on
        model.scrubber.castShadow = on
        model.voile.castShadow = on
        scarf.mesh.castShadow = on
      }
      shadows(ctx.quality.shadows)
      unsubs.push(ctx.quality.onChange((q) => {
        prints?.setCapacity(PRINTS[q.level])
        shadows(q.shadows)
      }))
      unsubs.push(ctx.bus.on('hero:kick', () => {
        lastKick = ctx.clock.elapsed
      }))

      const c = ctrl
      const m = model
      c.onStep((left) => {
        if (!prints || c.medium !== 'air' || c.wetness <= 0.1) return
        m.bones[left ? 'footL' : 'footR'].getWorldPosition(v2)
        v2.y = c.pos.y
        prints.stamp(v2, c.groundNormal, c.yaw, left, c.wetness, ctx.clock.elapsed)
      })

      model.root.position.copy(ctrl.pos)
      model.root.rotation.y = -ctrl.yaw
      model.root.updateMatrixWorld(true)
      scarf.reset(model.scarfAnchor.getWorldPosition(v))
      ctx.services.hero = service
    },

    update(dt, ctx) {
      if (!ctrl || !model || !anim || !cam || !mats) return
      ctrl.update(dt, cam.yaw)
      const out = ctrl.out
      model.root.position.copy(ctrl.pos)
      model.root.rotation.y = -ctrl.yaw

      params.t = ctx.clock.elapsed
      params.phase = out.phase
      params.speed = out.speed
      params.bank = out.bank
      params.pitch = out.pitch
      params.climbX = out.climbX
      params.climbY = out.climbY
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

      mats.wet.value = out.inWater ? 0 : THREE.MathUtils.clamp(ctrl.wetness * 0.9, 0, 0.6)
    },

    lateUpdate(dt, ctx) {
      if (!ctrl || !model || !cam || !scarf || !mats || !prints || !drops) return
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
      chestW.y += 0.05
      scarf.update(dt, {
        anchor: model.scarfAnchor.getWorldPosition(v),
        right, flow, inWater, wetness: ctrl.wetness, t: ctx.clock.elapsed, colliders,
        floorY: ctrl.grounded ? ctrl.pos.y : -1e4,
      })

      const drift = ctx.services.drift
      if (drift && !inWater) {
        const p = drift.pose().position
        if (hasLastDrift) prints.shift(p.x - lastDrift.x, p.y - lastDrift.y, p.z - lastDrift.z)
        lastDrift.set(p.x, p.y, p.z)
        hasLastDrift = true
      } else hasLastDrift = false
      prints.update(ctx.clock.elapsed, ctrl.wetness, INDOOR.wetnessDrySeconds)

      if (!inWater && ctrl.wetness > 0.02) {
        dripAcc += dt * ctrl.wetness * 16
        while (dripAcc >= 1) {
          dripAcc -= 1
          const r = Math.random()
          const src = r < 0.55 ? scarf.point(4 + Math.floor(Math.random() * 8)) : model.hairAnchor.getWorldPosition(v2)
          v.set((Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3)
          drops.emit(src, v, 1.2, 0.035 + Math.random() * 0.02)
        }
      } else dripAcc = 0
      if (inWater) {
        bubbleT -= dt
        const kicked = ctx.clock.elapsed - lastKick < 0.05
        if (bubbleT <= 0 || kicked) {
          bubbleT = 2.5 + Math.random() * 3
          const head = service.headPosition()
          const n = kicked ? 3 : 2 + Math.floor(Math.random() * 3)
          for (let i = 0; i < n; i++) {
            v2.set(head.x + right.x * 0.02, head.y - 0.12, head.z + right.z * 0.02)
            v.set((Math.random() - 0.5) * 0.25, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25)
            drops.emit(v2, v, 3 + Math.random() * 2, 0.04 + Math.random() * 0.05)
          }
        }
      }
      drops.update(dt, inWater, ctrl.pos.y)

      const out = ctrl.out
      cam.update(dt, {
        focus: ctrl.pos,
        heroYaw: yaw,
        moving: out.moving,
        indoor: !inWater,
        wide: out.gliding || out.riding,
        fast: out.sprinting,
        climbing: out.climbing,
        freeze: out.freezeCamera,
      })
      mats.fade.value = ctx.state.debug.cameraLocked ? 1 : 0.15 + 0.85 * cam.closeness
    },

    dispose() {
      for (const u of unsubs) u()
      unsubs.length = 0
      ctrl?.dispose()
      ctrl = null
      fader?.dispose()
      if (model) {
        model.root.removeFromParent()
        model.mesh.geometry.dispose()
        model.scrubber.geometry.dispose()
        model.voile.geometry.dispose()
      }
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
