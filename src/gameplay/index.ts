import type { GameContext, GameplayService, HeroMode, MusicCue, System, Vec3 } from '../core/types'
import { createBreath } from './breath'
import type { CameraDriver, Candidate, Gp } from './context'
import { createEnding } from './ending'
import { createIndoor } from './indoor'
import { createInventory } from './inventory'
import { createQuests } from './quests'
import { createScrub } from './scrub'
import { ACT_CARDS, INTRO, PROMPTS } from './text/fr'
import { createChart } from './ui/chart'
import { createCine } from './ui/cine'
import { createDialogue } from './ui/dialogue'
import { createHud } from './ui/hud'
import { createMenus } from './ui/menus'
import { GAMEPLAY_CSS } from './ui/styles'
import { createWeather } from './weather'
import { createCollectibles } from './world/collectibles'
import { createShallows } from './world/shallows'
import { createSondes } from './world/sondes'

interface Runtime {
  gp: Gp
  update(dt: number): void
  lateUpdate(dt: number): void
  dispose(): void
}

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

  const gp = {
    ctx,
    lock: { count: 0 },
    camera: createCameraDriver(ctx),
    toast: (t: string) => gp.hud.toast(t),
    cue: (c: MusicCue) => ctx.services.audio?.cue(c),
    sfx: (id: string, at?: Vec3) => ctx.services.audio?.sfx(id, at),
    heroPos: () => ctx.state.hero.position,
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
    busy: () =>
      gp.lock.count > 0 || gp.dialogue.active() || gp.menus.active() || gp.chart.isOpen() || gp.cine.active() || gp.ending.playing(),
    async sleepUntil(hour: number) {
      const st = ctx.state
      gp.lock.count++
      try {
        await gp.cine.fade('black', 1.2)
        gp.heroMode('sleep')
        const from = st.time.hours
        const target = ((hour % 24) + 24) % 24
        if (target <= from) st.time.day += 1
        st.time.hours = target
        gp.breath.refill()
        ctx.bus.emit('sleep:done', { fromHour: from, toHour: target, day: st.time.day })
        await gp.cine.wait(1.2)
        gp.heroMode('idle')
        await gp.cine.fade(null, 1.6)
      } finally {
        gp.lock.count--
      }
    },
  } as Gp

  gp.inv = createInventory(gp)
  gp.breath = createBreath(gp)
  gp.weather = createWeather(gp)
  gp.hud = createHud(gp, root)
  gp.chart = createChart(gp, root)
  gp.dialogue = createDialogue(gp, root)
  gp.menus = createMenus(gp, root)
  gp.cine = createCine(gp, root)
  gp.quests = createQuests(gp)
  gp.indoor = createIndoor(gp)
  gp.scrub = createScrub(gp)
  gp.ending = createEnding(gp)
  gp.sondes = createSondes(gp)
  gp.shallows = createShallows(gp)
  gp.collect = createCollectibles(gp)

  const st = ctx.state
  if (!st.flags['meteo-initiale']) {
    st.flags['meteo-initiale'] = true
    gp.weather.morning()
  }

  let hintId: string | null = null
  let introState: 'waiting' | 'playing' | 'done' = 'waiting'
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
      ctx.state.flags['intro'] = true
      gp.hud.showHud(true)
      gp.quests.start()
      void gp.cine.card(ACT_CARDS[1].titre, ACT_CARDS[1].sous, 3.4)
    } else gp.quests.start()
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
    const nearDrift = Math.hypot(s.hero.position.x - s.drift.position.x, s.hero.position.z - s.drift.position.z) < 180
    const night = s.time.hours < 5 || s.time.hours >= 19.5
    const want: MusicCue = s.env.rain > 0.5 ? 'rain' : s.hero.medium === 'air' || nearDrift ? 'drift' : night ? 'night' : 'explore'
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

      if (introState === 'waiting' && loadingGone()) void startStory()

      if (!paused) {
        gp.breath.update(dt)
        gp.weather.update(dt)
        gp.quests.update(dt)
        gp.sondes.update(dt)
        gp.shallows.update(dt)
        gp.collect.update(dt)
        gp.indoor.update(dt)
        gp.ending.update(dt)
        updateMusic(dt)
      }
      gp.scrub.update(dt)

      if (gp.chart.isOpen()) {
        if (input.pressed('map') || input.pressed('pause')) gp.chart.close()
      } else if (!wasBusy && !paused && introState === 'done') {
        if (input.pressed('map')) gp.chart.open()
        else if (input.pressed('inventory')) gp.menus.inventory()
        else if (input.pressed('pause')) gp.menus.pause()
      }

      candidates.length = 0
      const canInteract = !wasBusy && !gp.busy() && !paused && introState === 'done'
      if (canInteract) {
        gp.sondes.candidates(candidates)
        gp.shallows.candidates(candidates)
        gp.collect.candidates(candidates)
        gp.indoor.candidates(candidates)
        gp.quests.candidates(candidates)
      }
      let best: Candidate | null = null
      for (const c of candidates) if (!best || c.dist < best.dist) best = c
      const scrub = canInteract || gp.scrub.active() ? gp.scrub.best() : null
      const useScrub = !!scrub && (!best || scrub.dist <= best.dist || gp.scrub.active())
      if (useScrub && scrub) {
        gp.hud.prompt({ key: input.keyLabel('scrub'), label: PROMPTS.frotter })
        gp.hud.progress(1 - Math.min(1, scrub.coat))
      } else if (best) {
        gp.hud.prompt({ key: input.keyLabel('interact'), label: best.label })
        gp.hud.progress(null)
      } else {
        gp.hud.prompt(null)
        gp.hud.progress(null)
      }
      const newHint = useScrub && scrub ? `frotter:${scrub.id}` : best ? best.id : null
      if (newHint !== hintId) {
        hintId = newHint
        ctx.bus.emit('interact:hint', newHint ? { id: newHint, label: useScrub ? PROMPTS.frotter : best!.label } : null)
      }
      if (best && !useScrub && canInteract && input.pressed('interact')) {
        ctx.bus.emit('interact', { targetId: best.id, kind: best.kind })
        best.run()
      }

      gp.hud.update(dt)
    },
    lateUpdate(dt) {
      gp.sondes.lateUpdate(dt)
      gp.camera.lateUpdate()
    },
    dispose() {
      gp.sondes.dispose()
      gp.shallows.dispose()
      gp.collect.dispose()
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
      const service: GameplayService = {
        breath: {
          spend: (cost) => gp.breath.spend(cost),
          drain: (rate, dt) => gp.breath.drain(rate, dt),
          canAct: () => gp.breath.canAct(),
        },
        setAct: (act) => gp.quests.setAct(act),
        giveItem: (id, n = 1) => {
          gp.inv.give(id, n)
        },
        hasItem: (id) => gp.inv.has(id),
        setWeather: (env) => gp.weather.set(env),
        sleepUntil: (hour) => gp.sleepUntil(hour),
        chartCanvas: () => gp.chart.canvas,
      }
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
