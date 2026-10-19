import type { GameContext, GameplayService, HeroMode, MusicCue, System, Vec3 } from '../core/types'
import type { CameraDriver, Candidate, Gp } from './context'
import { progressOf } from './context'
import { createEndurance } from './endurance'
import { createEnding } from './ending'
import { createIndoor } from './indoor'
import { createInventory } from './inventory'
import { createQuests } from './quests'
import { DISTRICT_NAMES, INTRO, ACT_CARDS, PROMPTS, UI } from './text/fr'
import { createTours } from './tours'
import { createTravel } from './travel'
import { createChart } from './ui/chart'
import { createCine } from './ui/cine'
import { createDialogue } from './ui/dialogue'
import { createHud } from './ui/hud'
import { createMenus } from './ui/menus'
import { GAMEPLAY_CSS } from './ui/styles'
import { createWeather } from './weather'
import { createCollectibles } from './world/collectibles'
import { createDomes } from './world/domes'
import { createScellees } from './world/scellees'
import { createGather } from './world/gather'
import { createScelleeProps } from './world/props'
import { createProue } from './world/proue'
import { createScrub } from './scrub'
import { createSites } from './world/sites'
import { createUses } from './world/uses'

interface Runtime {
  gp: Gp
  update(dt: number): void
  lateUpdate(dt: number): void
  dispose(): void
}

type LooseBus = { emit(k: string, p: unknown): void }

function createCameraDriver(ctx: GameContext): CameraDriver {
  let pose: { position: Vec3; target: Vec3; fov?: number } | null = null
  return {
    set(p) {
      pose = p
      ctx.services.hero?.setCameraPose(p)
    },
    lateUpdate() {
      if (!pose || ctx.services.hero) return
      const c = ctx.camera
      c.position.set(pose.position.x, pose.position.y, pose.position.z)
      if (pose.fov !== undefined && c.fov !== pose.fov) {
        c.fov = pose.fov
        c.updateProjectionMatrix()
      }
      c.lookAt(pose.target.x, pose.target.y, pose.target.z)
    },
  }
}

function createRuntime(ctx: GameContext): Runtime {
  const style = document.createElement('style')
  style.textContent = GAMEPLAY_CSS
  document.head.appendChild(style)
  const root = document.createElement('div')
  root.className = 'gp-root'
  ctx.uiRoot.appendChild(root)

  const sites = createSites(ctx)
  const gp = {
    ctx,
    sites,
    toWorld: (l: Vec3) => ctx.services.drift?.toWorld(l) ?? l,
    lock: { count: 0 },
    camera: createCameraDriver(ctx),
    toast: (t: string) => gp.hud.toast(t),
    cue: (c: MusicCue) => ctx.services.audio?.cue(c),
    sfx: (id: string, at?: Vec3) => ctx.services.audio?.sfx(id, at),
    emit: (name: string, payload: unknown) => (ctx.bus as unknown as LooseBus).emit(name, payload),
    progress: () => progressOf(ctx.state),
    heroPos: () => ctx.state.hero.position,
    heroLocal: () => ctx.state.hero.localPosition ?? ctx.services.drift?.toLocal(ctx.state.hero.position) ?? ctx.state.hero.position,
    headPos: () => {
      const h = ctx.services.hero?.headPosition()
      if (h) return h
      const p = ctx.state.hero.position
      return { x: p.x, y: p.y + 1.5, z: p.z }
    },
    heroForward: () => {
      const yaw = ctx.state.hero.yaw
      return { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
    },
    heroMode: (m: HeroMode) => {
      const hero = ctx.services.hero
      if (hero) hero.setMode(m)
      else ctx.state.hero.mode = m
    },
    driftLock: () => {
      const d = ctx.services.drift
      if (d) return d.lockPosition()
      const p = ctx.state.drift.position
      return { x: p.x, y: p.y - 8, z: p.z + 82 }
    },
    say: (lines: Parameters<Gp['say']>[0], npc?: string) => gp.dialogue.play(lines, npc),
    busy: () =>
      gp.lock.count > 0 || gp.dialogue.active() || gp.menus.active() || gp.chart.isOpen() || gp.cine.active() || gp.ending.playing(),
    async sleepUntil(hour: number) {
      const s = ctx.state
      gp.lock.count++
      try {
        await gp.cine.fade('black', 1.2)
        gp.heroMode('sleep')
        const from = s.time.hours
        const target = ((hour % 24) + 24) % 24
        if (target <= from) s.time.day += 1
        s.time.hours = target
        gp.endurance.refill()
        ctx.bus.emit('sleep:done', { fromHour: from, toHour: target, day: s.time.day })
        if (target === 6) gp.weather.morning()
        await gp.cine.wait(1.2)
        gp.heroMode('idle')
        await gp.cine.fade(null, 1.6)
        gp.toast(UI.sommeil.sauve)
      } finally {
        gp.lock.count--
      }
    },
  } as unknown as Gp

  progressOf(ctx.state)
  gp.inv = createInventory(gp)
  gp.endurance = createEndurance(gp)
  gp.weather = createWeather(gp)
  gp.hud = createHud(gp, root)
  gp.chart = createChart(gp, root)
  gp.dialogue = createDialogue(gp, root)
  gp.menus = createMenus(gp, root)
  gp.cine = createCine(gp, root)
  gp.travel = createTravel(gp)
  const uses = createUses(gp)
  gp.tours = createTours(gp)
  gp.domes = createDomes(gp, uses)
  gp.scellees = createScellees(gp, uses)
  gp.collect = createCollectibles(gp, uses)
  gp.scrub = createScrub(gp)
  gp.proue = createProue(gp, gp.scrub)
  gp.gather = createGather(gp)
  gp.quests = createQuests(gp)
  gp.indoor = createIndoor(gp, uses)
  gp.ending = createEnding(gp)
  const props = createScelleeProps(gp, (id) => gp.scellees.view(id))

  const s0 = ctx.state
  if (!s0.flags['meteo-initiale']) {
    s0.flags['meteo-initiale'] = true
    gp.weather.morning()
  }

  ctx.bus.on('district:entered', ({ district }) => {
    if (ctx.state.mode !== 'inside' || gp.busy()) return
    const key = `lieu:${district}:${ctx.state.time.day}`
    if (ctx.state.flags[key]) return
    ctx.state.flags[key] = true
    gp.hud.placeName(DISTRICT_NAMES[district])
  })

  let hintId: string | null = null
  let introState: 'waiting' | 'playing' | 'done' = 'waiting'
  let introGrace = 0
  let wakeT = 0
  let busyPrev = false
  let musicTimer = 0
  let music: MusicCue | null = null
  const candidates: Candidate[] = []

  const startStory = async () => {
    introState = 'playing'
    const fresh = Object.keys(ctx.state.quests).length === 0 && !ctx.state.flags['intro']
    if (fresh) {
      gp.hud.showHud(false)
      gp.lock.count++
      gp.heroMode('cutscene')
      try {
        await gp.cine.narrate(INTRO)
      } finally {
        gp.lock.count--
      }
      gp.heroMode('idle')
      introGrace = 1.2
      wakeT = 40
      ctx.state.flags['intro'] = true
      gp.hud.showHud(true)
      gp.quests.start()
      void gp.cine.card(ACT_CARDS[1].titre, ACT_CARDS[1].sous, 3.4)
    } else {
      gp.hud.showHud(true)
      gp.quests.start()
    }
    introState = 'done'
  }

  const loadingGone = () => {
    const el = document.getElementById('loading')
    return !el || el.classList.contains('gone')
  }

  const updateMusic = (dt: number) => {
    musicTimer -= dt
    if (musicTimer > 0 || gp.busy()) return
    musicTimer = 2
    const s = ctx.state
    const night = s.time.hours < 5 || s.time.hours >= 19.5
    const home = s.hero.district === 'ecluse' && s.mode === 'inside'
    const want: MusicCue = s.env.rain > 0.5 ? 'rain' : night ? 'night' : home ? 'drift' : 'explore'
    if (want !== music) {
      music = want
      gp.cue(want)
    }
  }

  return {
    gp,
    update(dt) {
      const paused = ctx.clock.paused
      const input = ctx.input
      const wasBusy = gp.busy()

      gp.cine.update(dt)
      gp.dialogue.update(dt)
      gp.menus.update(dt)
      gp.chart.update(dt)

      if (introState === 'waiting') {
        if (loadingGone()) void startStory()
        else gp.hud.showHud(false)
      }

      if (!paused) {
        gp.endurance.update(dt)
        gp.weather.update(dt)
        gp.quests.update(dt)
        gp.scellees.update(dt)
        props.update(dt)
        gp.scrub.update(dt)
        gp.proue.update(dt)
        gp.tours.update(dt)
        gp.indoor.update(dt)
        gp.ending.update(dt)
        updateMusic(dt)
      }

      if (gp.chart.isOpen()) {
        if (input.pressed('map') || input.pressed('pause')) gp.chart.close()
      } else if (!wasBusy && !paused && introState === 'done') {
        if (input.pressed('map')) gp.chart.open('plan')
        else if (input.pressed('inventory')) gp.menus.inventory()
        else if (input.pressed('pause')) gp.menus.pause()
      }

      candidates.length = 0
      if (introGrace > 0 && input.down('interact')) introGrace = Math.max(introGrace, 0.4)
      introGrace = Math.max(0, introGrace - dt)
      if (wakeT > 0) wakeT = Math.hypot(input.move.x, input.move.y) > 0.3 ? 0 : wakeT - dt
      const canInteract = !wasBusy && !gp.busy() && !paused && introState === 'done' && introGrace <= 0
      if (canInteract) {
        uses.candidates(candidates)
        gp.collect.candidates(candidates)
        gp.indoor.candidates(candidates)
        gp.proue.candidates(candidates)
        gp.gather.candidates(candidates)
        gp.quests.candidates(candidates)
      }
      let best: Candidate | null = null
      for (const c of candidates) if ((!best || c.dist < best.dist) && !(wakeT > 0 && c.kind === 'bed')) best = c
      const held = hintId && best && best.id !== hintId ? candidates.find((c) => c.id === hintId) : undefined
      if (held && best && held.dist < best.dist + 0.35 && !(wakeT > 0 && held.kind === 'bed')) best = held
      const outsideScrub = canInteract ? gp.scrub.target() : null
      if (outsideScrub && (!best || best.kind === 'airlock')) {
        gp.hud.prompt({ key: input.keyLabel('scrub'), label: PROMPTS.frotter })
        if (!gp.scrub.scrubbing()) gp.hud.progress(1 - outsideScrub.coat)
      } else if (best) {
        gp.hud.prompt({ key: input.keyLabel('interact'), label: best.label })
        if (!best.hold) gp.hud.progress(null)
      } else {
        gp.hud.prompt(null)
        gp.hud.progress(null)
      }
      const newHint = best ? best.id : null
      if (newHint !== hintId) {
        hintId = newHint
        ctx.bus.emit('interact:hint', best ? { id: best.id, label: best.label } : null)
      }
      if (best && !best.hold && canInteract && input.pressed('interact')) {
        ctx.bus.emit('interact', { targetId: best.id, kind: best.kind as never })
        best.run()
      }

      const busyNow = gp.busy()
      if (busyPrev && !busyNow) introGrace = Math.max(introGrace, 0.5)
      busyPrev = busyNow
      gp.hud.update(dt)
    },
    lateUpdate() {
      gp.camera.lateUpdate()
    },
    dispose() {
      root.remove()
      style.remove()
    },
  }
}

export function createGameplaySystem(): System {
  let rt: Runtime | null = null
  return {
    id: 'gameplay',
    init(ctx) {
      rt = createRuntime(ctx)
      const gp = rt.gp
      const endurance = {
        spend: (cost: number) => gp.endurance.spend(cost),
        drain: (rate: number, dt: number) => gp.endurance.drain(rate, dt),
        canAct: () => gp.endurance.canAct(),
      }
      const service: GameplayService = {
        breath: endurance,
        setAct: (act) => gp.quests.setAct(act),
        giveItem: (id, n = 1) => {
          gp.inv.give(id, n)
        },
        hasItem: (id) => gp.inv.has(id),
        setWeather: (env) => gp.weather.set(env),
        sleepUntil: (hour) => gp.sleepUntil(hour),
        chartCanvas: () => gp.chart.canvas,
      }
      Object.assign(service, { endurance, planCanvas: () => gp.chart.plan })
      ctx.services.gameplay = service
      if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __gameplay: Gp }).__gameplay = gp
    },
    update(dt) {
      rt?.update(dt)
    },
    lateUpdate(dt) {
      rt?.lateUpdate(dt)
    },
    dispose() {
      rt?.dispose()
      rt = null
    },
  }
}
