import * as THREE from 'three'
import { CHOSE_DIVE_HOURS, DRIFT_ROUTE } from '../core/layout'
import type { FaunaService, GameContext, System, Vec3 } from '../core/types'
import { Bubbles } from './bubbles'
import { Chose } from './chose'
import { Curious } from './curious'
import { FishSchools } from './fish'
import { Jellyfish } from './jellyfish'
import { Manta } from './manta'
import { Motes } from './motes'
import { clampWaterY, faunaTime } from './shared'
import { DriftFrame, Stage } from './stage'
import { Turtle } from './turtle'
import { Whale } from './whale'

const DIVE_WAIT_SECONDS = 40
const WHALE_DAY_PERIOD = 2
const WHALE_WAIT_HOURS = 3
const RAY_MIN_SECONDS = 220
const RAY_MAX_SECONDS = 420

interface Parts {
  root: THREE.Group
  frame: DriftFrame
  stage: Stage
  bubbles: Bubbles
  fish: FishSchools
  jelly: Jellyfish
  whale: Whale
  manta: Manta
  turtle: Turtle
  chose: Chose
  motes: Motes
  curious: Curious
}

function routeLength(from: number, to: number): number {
  let d = 0
  for (let i = from; i < to; i++) {
    const a = DRIFT_ROUTE[i]!, b = DRIFT_ROUTE[i + 1]!
    d += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return d
}

const NORTH_START = routeLength(0, 2)
const NORTH_END = routeLength(0, DRIFT_ROUTE.length - 1)

function dayHash(day: number, salt: number): number {
  const h = Math.sin(day * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

function crossed(prev: number, now: number, mark: number): boolean {
  return now >= prev ? prev < mark && now >= mark : prev < mark || now >= mark
}

export function createFaunaSystem(): System {
  let parts: Parts | null = null
  let lastHours = 0
  let lastDay = 0
  let diveDue = -1
  let whaleDue = -1
  let rayIn = 90
  let externalRain = 0
  let ownRipple = false
  const unsubs: (() => void)[] = []
  const scratch = new THREE.Vector3()
  let rng: () => number = Math.random

  /** Where La Chose takes its fish: in front of the glass Ilo is at, closer as the Drift goes north. */
  function diveTarget(ctx: GameContext, p: Parts): Vec3 {
    const s = ctx.state
    const st = p.stage
    let d = 50 + rng() * 15
    if (s.act === 2) {
      const k = THREE.MathUtils.clamp((s.drift.progress - NORTH_START) / Math.max(1, NORTH_END - NORTH_START), 0, 1)
      d = THREE.MathUtils.lerp(70, 24, k)
    } else if (s.act === 3) d = 20
    const out = new THREE.Vector3()
    if (st.kind === 'sortie') {
      const yaw = s.hero.yaw + (rng() - 0.5) * 0.8
      out.set(st.pos.x + Math.sin(yaw) * d * 0.6, st.pos.y + 4, st.pos.z - Math.cos(yaw) * d * 0.6)
    } else if (st.normal.y > 0.6) {
      st.point(8 + rng() * 6, (rng() - 0.5) * d * 0.8, d * 0.6, out)
    } else {
      st.point(d, (rng() - 0.5) * d * 0.5, 2 + rng() * 5, out)
    }
    out.y = clampWaterY(ctx, out.x, out.y, out.z, 4, 8)
    return { x: out.x, y: out.y, z: out.z }
  }

  function schedule(ctx: GameContext, p: Parts, dt: number): void {
    const { hours, day } = ctx.state.time
    const delta = (day - lastDay) * 24 + (hours - lastHours)
    if (delta > 0 && delta < 0.5) {
      for (const mark of CHOSE_DIVE_HOURS) {
        if (crossed(lastHours, hours, mark)) diveDue = ctx.clock.elapsed + DIVE_WAIT_SECONDS
      }
      if (day % WHALE_DAY_PERIOD === 0 && crossed(lastHours, hours, 8 + dayHash(day, 1) * 9)) whaleDue = day * 24 + hours + WHALE_WAIT_HOURS
      if (ctx.state.act >= 2 && day % 3 === 1 && crossed(lastHours, hours, 13 + dayHash(day, 2) * 4) && !p.turtle.active) p.turtle.start()
    }
    lastHours = hours
    lastDay = day
    const st = p.stage
    if (diveDue >= 0) {
      const late = ctx.clock.elapsed >= diveDue
      if (st.visible && (st.kind === 'window' || st.kind === 'dome' || st.kind === 'sortie' || late)) {
        diveDue = -1
        const scripted = ctx.clock.elapsed - p.chose.lastDiveElapsed < 30
        const sceneOwnsIt = ctx.state.act === 3 && ctx.state.hero.medium === 'air' && ctx.state.quests['a3-matin'] !== 'done'
        if (!scripted && !sceneOwnsIt && !p.chose.busy) void p.chose.dive(diveTarget(ctx, p), false)
      } else if (late && ctx.clock.elapsed > diveDue + 120) diveDue = -1
    }
    if (whaleDue >= 0 && !p.whale.isActive) {
      if (st.visible && st.kind !== 'free') {
        whaleDue = -1
        p.whale.pass(st, st.kind === 'sortie' ? 26 : 32 + rng() * 14)
      } else if (day * 24 + hours > whaleDue) whaleDue = -1
    }
    const h = hours
    if (st.visible && h > 6.5 && h < 19 && !p.manta.isActive) {
      rayIn -= dt
      if (rayIn <= 0) {
        rayIn = RAY_MIN_SECONDS + rng() * (RAY_MAX_SECONDS - RAY_MIN_SECONDS)
        p.manta.pass(st, 16 + rng() * 20, 1 + Math.floor(rng() * 3))
      }
    }
  }

  function rain(ctx: GameContext, p: Parts, dt: number): void {
    externalRain = Math.max(0, externalRain - dt)
    const amount = ctx.state.env.rain
    if (amount <= 0.01 || externalRain > 0 || !p.stage.visible) return
    const st = p.stage
    const c = st.kind === 'sortie' ? st.pos : st.point(30, 0, 0, scratch)
    p.bubbles.rain(dt, c.x, c.z, 70, amount * 110)
    if (amount > 0.3) p.bubbles.rain(dt * 0.3, c.x + st.tangent.x * 90, c.z + st.tangent.z * 90, 60, amount * 110)
  }

  function build(ctx: GameContext): Parts {
    const root = new THREE.Group()
    root.name = 'fauna'
    const frame = new DriftFrame()
    frame.sync(ctx)
    const stage = new Stage(ctx, frame)
    const bubbles = new Bubbles(ctx)
    const fish = new FishSchools(ctx, stage, frame, ctx.quality.fishCount)
    const jelly = new Jellyfish(ctx, stage, frame)
    const whale = new Whale(ctx, frame, bubbles)
    const manta = new Manta(ctx, frame)
    const turtle = new Turtle(ctx, stage, frame, bubbles)
    const chose = new Chose(ctx, stage, frame, bubbles, fish)
    const motes = new Motes(ctx, stage)
    const curious = new Curious(ctx, stage, bubbles)
    root.add(fish.group, jelly.group, whale.group, manta.group, turtle.group, chose.group, bubbles.group, motes.group,
      curious.group, chose.shadow.mesh, chose.pages.group)
    ctx.scene.add(root)
    return { root, frame, stage, bubbles, fish, jelly, whale, manta, turtle, chose, motes, curious }
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
          p.frame.sync(ctx)
          p.stage.update(0)
          if (id === 'tortue-premiere') p.turtle.start()
          else if (id === 'raie-coincee') p.manta.pass(p.stage, 14, 3)
          else p.whale.pass(p.stage, p.stage.kind === 'sortie' ? 24 : 30)
        },
        manta: () => null,
        jellyfishNear: (pos, r) => p.jelly.near(pos, r),
        attractSchool: (pos) => p.fish.attract(pos),
      }
      ctx.services.fauna = service
      unsubs.push(ctx.quality.onChange((q) => {
        if (q.fishCount !== p.fish.count) p.fish.resize(q.fishCount)
      }))
      unsubs.push(ctx.bus.on('interact', ({ kind }) => {
        if (kind === 'window') p.curious.startle(null)
      }))
      unsubs.push(ctx.bus.on('chose:dive', ({ position, phase }) => {
        if (phase !== 'ascend') p.curious.startle(position)
      }))
      unsubs.push(ctx.bus.on('ceiling:ripple', ({ x, z, strength }) => {
        if (ownRipple) return
        externalRain = 2
        p.bubbles.rings(x, z, Math.min(1.2, strength * 0.6))
      }))
      const emit = ctx.bus.emit.bind(ctx.bus)
      p.chose.onRipple = (x, z, strength) => {
        ownRipple = true
        try {
          emit('ceiling:ripple', { x, z, strength })
        } finally {
          ownRipple = false
        }
      }
    },
    update(dt, ctx) {
      const p = parts
      if (!p) return
      faunaTime.value = ctx.clock.elapsed
      p.frame.sync(ctx)
      p.stage.update(dt)
      p.root.visible = p.stage.visible
      schedule(ctx, p, dt)
      rain(ctx, p, dt)
      p.chose.update(dt)
      p.whale.update(dt)
      p.turtle.update(dt)
      p.manta.update(dt)
      p.bubbles.update(dt)
      p.chose.updatePages(dt)
      if (!p.stage.visible) return
      p.fish.update(dt)
      p.jelly.update(dt)
      p.motes.update(dt)
      p.curious.update(dt)
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
      p.motes.dispose()
      p.curious.dispose()
      p.root.removeFromParent()
    },
  }
}

