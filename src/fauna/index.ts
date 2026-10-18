import * as THREE from 'three'
import { CHOSE_DIVE_HOURS, DRIFT_ROUTE, DRIFT_Y } from '../core/layout'
import type { FaunaService, GameContext, System, Vec3 } from '../core/types'
import { Bubbles } from './bubbles'
import { Chose } from './chose'
import { FishSchools } from './fish'
import { Jellyfish } from './jellyfish'
import { Manta } from './manta'
import { Rider } from './rider'
import { clampWaterY, faunaTime } from './shared'
import { Turtle } from './turtle'
import { Whale } from './whale'

const SCRIPT_GRACE_SECONDS = 1.5
const WHALE_DAY_PERIOD = 2

interface Parts {
  root: THREE.Group
  bubbles: Bubbles
  fish: FishSchools
  jelly: Jellyfish
  whale: Whale
  manta: Manta
  turtle: Turtle
  chose: Chose
  rider: Rider
}

function routeLength(from: number, to: number): number {
  let d = 0
  for (let i = from; i < to; i++) {
    const a = DRIFT_ROUTE[i], b = DRIFT_ROUTE[i + 1]
    d += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return d
}

const NORTH_START = routeLength(0, 2)
const NORTH_END = routeLength(0, DRIFT_ROUTE.length - 1)

function whaleHour(day: number): number {
  const h = Math.sin(day * 12.9898) * 43758.5453
  return 8 + (h - Math.floor(h)) * 9
}

export function createFaunaSystem(): System {
  let parts: Parts | null = null
  let lastHours = 0
  let lastDay = 0
  let pendingDive = -1
  const unsubs: (() => void)[] = []

  let rng: () => number = Math.random

  function scheduledTarget(ctx: GameContext): Vec3 {
    const s = ctx.state
    const hero = s.hero.position
    const drift = ctx.services.drift?.pose() ?? s.drift
    if (s.hero.medium === 'air') {
      const h = drift.heading
      const x = drift.position.x + Math.sin(h) * 110
      const z = drift.position.z - Math.cos(h) * 110
      return { x, y: clampWaterY(ctx, x, DRIFT_Y - 4, z, 4, 8), z }
    }
    let d = 30
    if (s.act === 2) {
      const k = THREE.MathUtils.clamp((s.drift.progress - NORTH_START) / Math.max(1, NORTH_END - NORTH_START), 0, 1)
      d = THREE.MathUtils.lerp(130, 22, k)
    } else if (s.act === 3) d = 20
    const yaw = s.hero.yaw + (rng() - 0.5) * 0.8
    const x = hero.x + Math.sin(yaw) * d
    const z = hero.z - Math.cos(yaw) * d
    return { x, y: clampWaterY(ctx, x, hero.y + 4, z, 3, 8), z }
  }

  function crossed(prev: number, now: number, mark: number): boolean {
    return now >= prev ? prev < mark && now >= mark : prev < mark || now >= mark
  }

  function schedule(ctx: GameContext, p: Parts): void {
    const { hours, day } = ctx.state.time
    const delta = (day - lastDay) * 24 + (hours - lastHours)
    if (delta > 0 && delta < 0.5) {
      for (const mark of CHOSE_DIVE_HOURS) {
        if (crossed(lastHours, hours, mark)) pendingDive = ctx.clock.elapsed + SCRIPT_GRACE_SECONDS
      }
      if (day % WHALE_DAY_PERIOD === 0 && crossed(lastHours, hours, whaleHour(day)) && !p.whale.isActive) {
        const hero = ctx.state.hero.position
        if (hero.z > -350) {
          if (ctx.state.hero.medium === 'air') {
            const d = ctx.services.drift?.pose().position ?? ctx.state.drift.position
            p.whale.pass({ x: d.x, y: DRIFT_Y - 8, z: d.z }, 150)
          } else p.whale.pass(hero, 26)
        }
      }
    }
    lastHours = hours
    lastDay = day
    if (pendingDive >= 0 && ctx.clock.elapsed >= pendingDive) {
      pendingDive = -1
      const scripted = ctx.clock.elapsed - p.chose.lastDiveElapsed < 30
      const sceneOwnsIt = ctx.state.act === 3 && ctx.state.hero.medium === 'air'
      if (!scripted && !sceneOwnsIt && !p.chose.busy) void p.chose.dive(scheduledTarget(ctx), false)
    }
  }

  function build(ctx: GameContext): Parts {
    const root = new THREE.Group()
    root.name = 'fauna'
    const rider = new Rider(ctx)
    const bubbles = new Bubbles(ctx)
    const fish = new FishSchools(ctx, ctx.quality.fishCount)
    const jelly = new Jellyfish(ctx)
    const whale = new Whale(ctx, bubbles, rider)
    const manta = new Manta(ctx, rider)
    const turtle = new Turtle(ctx)
    const chose = new Chose(ctx, bubbles, fish)
    root.add(fish.group, jelly.group, whale.group, manta.group, turtle.group, chose.group, bubbles.group)
    ctx.scene.add(root)
    return { root, bubbles, fish, jelly, whale, manta, turtle, chose, rider }
  }

  return {
    id: 'fauna',
    init(ctx) {
      const p = build(ctx)
      rng = ctx.rng('fauna:schedule')
      parts = p
      lastHours = ctx.state.time.hours
      lastDay = ctx.state.time.day
      const service: FaunaService = {
        choseDive: (target, close) => p.chose.dive(target, close),
        spawnScripted(id) {
          if (id === 'tortue-premiere') p.turtle.start()
          else if (id === 'raie-coincee') p.manta.spawnCaught()
          else {
            const hero = ctx.state.hero.position
            p.whale.pass(hero, 24)
          }
        },
        manta: () => p.manta.api(),
        jellyfishNear: (pos, r) => p.jelly.near(pos, r),
        attractSchool: (pos) => p.fish.attract(pos),
      }
      ctx.services.fauna = service
      unsubs.push(ctx.quality.onChange((q) => {
        if (q.fishCount !== p.fish.count) p.fish.resize(q.fishCount)
      }))
      unsubs.push(ctx.bus.on('interact', (e) => {
        if (e.kind === 'manta') p.manta.mount()
      }))
    },
    update(dt, ctx) {
      const p = parts
      if (!p) return
      faunaTime.value = ctx.clock.elapsed
      p.rider.tick(dt)
      schedule(ctx, p)
      p.fish.update(dt)
      p.jelly.update(dt)
      p.whale.update(dt)
      p.manta.update(dt)
      p.turtle.update(dt)
      p.chose.update(dt)
      p.bubbles.update(dt)
    },
    lateUpdate() {
      if (!parts) return
      parts.whale.lateUpdate()
      parts.manta.lateUpdate()
    },
    dispose() {
      for (const u of unsubs.splice(0)) u()
      const p = parts
      if (!p) return
      parts = null
      p.chose.dispose()
      p.whale.dispose()
      p.manta.dispose()
      p.turtle.dispose()
      p.jelly.dispose()
      p.fish.dispose()
      p.bubbles.dispose()
      p.root.removeFromParent()
    },
  }
}
