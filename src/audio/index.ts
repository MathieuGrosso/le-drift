import { CEILING_Y, VENT_UPDRAFT } from '../core/layout'
import { phaseAt } from '../core/state'
import type { AudioService, DayPhase, GameContext, MusicCue, System, Vec3 } from '../core/types'
import { createAmbience, type Ambience } from './ambience'
import { createMusicDirector, type MusicDirector } from './music'
import { createRig, type Rig } from './rig'
import { playSfx, playStep } from './sfx'

const OVERRIDE_TTL: Record<MusicCue, number> = {
  explore: 0, drift: 60, sonde: 28, shallow: 600, danger: 20, night: 60, wonder: 45, rain: 1e9, silence: 1e9,
}
const DRIFT_HEAR_RADIUS = 220
const SPATIAL_MAX = 260

interface Live {
  rig: Rig
  music: MusicDirector
  amb: Ambience
}

export function createAudioSystem(): System {
  let live: Live | null = null
  let game: GameContext | null = null
  let starting: Promise<void> | null = null
  let rnd: () => number = Math.random
  const offs: (() => void)[] = []

  let override: MusicCue | null = null
  let overrideLeft = 0
  let phase: DayPhase = 'jour'
  let shallowId: string | null = null
  let choseLeft = 0
  let dangerLeft = 0
  let jellyCheck = 0
  let duck = 1
  let scrubCooldown = 0
  let lastHeading: number | null = null
  let groanCooldown = 0
  const warned = new Set<string>()

  function at(p: Vec3 | undefined): AudioNode | null {
    if (!live) return null
    const { rig } = live
    if (!p) return rig.sfx
    const cam = game?.camera.position
    if (cam) {
      const dx = p.x - cam.x
      const dy = p.y - cam.y
      const dz = p.z - cam.z
      if (dx * dx + dy * dy + dz * dz > SPATIAL_MAX * SPATIAL_MAX) return null
    }
    const pan = rig.ctx.createPanner()
    pan.panningModel = 'equalpower'
    pan.distanceModel = 'inverse'
    pan.refDistance = 6
    pan.maxDistance = SPATIAL_MAX
    pan.rolloffFactor = 1.1
    pan.positionX.value = p.x
    pan.positionY.value = p.y
    pan.positionZ.value = p.z
    pan.connect(rig.sfx)
    window.setTimeout(() => pan.disconnect(), 12000)
    return pan
  }

  function sfx(id: string, p?: Vec3, amount = 1): void {
    if (!live || live.rig.ctx.state !== 'running') return
    const dest = at(p)
    if (!dest) return
    if (!playSfx(live.rig, dest, id, live.rig.ctx.currentTime + 0.01, amount) && !warned.has(id)) {
      warned.add(id)
      console.warn(`[audio] unknown sfx "${id}"`)
    }
  }

  function cue(c: MusicCue): void {
    if (c === 'explore') {
      override = null
      overrideLeft = 0
    } else {
      override = c
      overrideLeft = OVERRIDE_TTL[c]
    }
    if (live && c === 'sonde') {
      if (live.music.cue === 'sonde') live.music.stinger('sonde')
      else live.music.setCue('sonde')
    }
  }

  function autoCue(ctx: GameContext): MusicCue {
    const s = ctx.state
    if (s.env.rain > 0.3) return 'rain'
    if (choseLeft > 0) return 'wonder'
    if (shallowId) return 'shallow'
    if (dangerLeft > 0) return 'danger'
    if (s.hero.medium === 'air') return 'drift'
    const h = s.hero.position
    const d = s.drift.position
    if (Math.hypot(h.x - d.x, h.z - d.z) < DRIFT_HEAR_RADIUS) return phase === 'nuit' ? 'night' : 'drift'
    if (phase === 'nuit') return 'night'
    return 'explore'
  }

  function build(ctx: AudioContext): Live {
    const rig = createRig(ctx)
    const music = createMusicDirector(rig, rnd)
    const amb = createAmbience(
      rig,
      {
        oneShot(id, amount, near) {
          let p: Vec3 | undefined
          const cam = game?.camera.position
          if (near && cam) {
            p = { x: cam.x + (Math.random() - 0.5) * 14, y: cam.y + (Math.random() - 0.3) * 3, z: cam.z + (Math.random() - 0.5) * 14 }
          }
          sfx(id, p, amount)
        },
      },
      rnd,
    )
    return { rig, music, amb }
  }

  function unlock(): Promise<void> {
    if (live) return live.rig.ctx.state === 'running' ? Promise.resolve() : live.rig.ctx.resume()
    if (starting) return starting
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return Promise.resolve()
    const ctx = new Ctor({ latencyHint: 'interactive' })
    live = build(ctx)
    starting = ctx.resume().finally(() => {
      starting = null
    })
    return starting
  }

  const service: AudioService = { cue, sfx: (id, p) => sfx(id, p), unlock }

  const onGesture = () => {
    unlock()
      .then(() => {
        if (live?.rig.ctx.state === 'running') {
          window.removeEventListener('pointerdown', onGesture, true)
          window.removeEventListener('keydown', onGesture, true)
        }
      })
      .catch(() => undefined)
  }

  function wire(ctx: GameContext): void {
    const bus = ctx.bus
    const hero = () => ctx.state.hero.position
    offs.push(
      bus.on('audio:cue', ({ cue: c }) => cue(c)),
      bus.on('time:phase', ({ phase: p }) => {
        phase = p
      }),
      bus.on('game:paused', ({ paused }) => {
        duck = paused ? 0.35 : 1
        if (live) live.rig.master.gain.setTargetAtTime(ctx.state.settings.volume * duck, live.rig.ctx.currentTime, 0.2)
      }),
      bus.on('hero:kick', () => sfx('kick', undefined, 0.8)),
      bus.on('hero:landed', ({ speed, kind }) => {
        const a = Math.min(1, speed / 6)
        if (a > 0.15) sfx(kind === 'terrain' ? 'land' : 'step-bois', undefined, a)
      }),
      bus.on('hero:breathEmpty', () => sfx('breath-empty')),
      bus.on('hero:breathFull', () => sfx('breath-full')),
      bus.on('hero:stung', () => {
        sfx('sting')
        dangerLeft = Math.max(dangerLeft, 15)
      }),
      bus.on('hero:medium', ({ medium }) => sfx(medium === 'water' ? 'splash' : 'sas', undefined, 0.5)),
      bus.on('hero:mode', ({ to }) => {
        if (to === 'glide') sfx('voile')
      }),
      bus.on('hero:step', ({ surface, wet }) => {
        if (live && live.rig.ctx.state === 'running') playStep(live.rig, live.rig.sfx, live.rig.ctx.currentTime + 0.005, surface, wet)
      }),
      bus.on('airlock:cycle', ({ phase: p }) => {
        if (p === 'close' || p === 'open') sfx('lock-clang', hero())
        if (p === 'pump') sfx('pump', hero())
        if (p === 'open') sfx('sas', hero())
      }),
      bus.on('door:changed', () => sfx('door', hero())),
      bus.on('scrub:progress', () => {
        if (scrubCooldown > 0) return
        scrubCooldown = 0.14 + rnd() * 0.12
        sfx('scrub', undefined, 0.6 + rnd() * 0.4)
      }),
      bus.on('scrub:done', () => sfx('scrub-done')),
      bus.on('sonde:activated', () => {
        sfx('sonde')
        cue('sonde')
      }),
      bus.on('shallow:entered', ({ id }) => {
        shallowId = id
      }),
      bus.on('shallow:completed', () => {
        shallowId = null
        live?.music.stinger('decouverte')
      }),
      bus.on('collectible:found', () => live?.music.stinger('trouvaille')),
      bus.on('quest:completed', () => live?.music.stinger('decouverte')),
      bus.on('item:gained', () => sfx('pickup')),
      bus.on('cook:done', () => sfx('cook')),
      bus.on('sleep:done', () => live?.music.stinger('reveil')),
      bus.on('ui:menu', ({ open }) => {
        if (open === 'carte') sfx('paper')
        else sfx(open ? 'menu-open' : 'menu-close')
      }),
      bus.on('chose:dive', ({ position, phase: p }) => {
        if (p === 'descend') {
          sfx('bird', { x: position.x, y: Math.min(position.y + 20, CEILING_Y), z: position.z })
          choseLeft = 40
        } else if (p === 'grab') {
          sfx('splash', position, 0.6)
          choseLeft = Math.max(choseLeft, 20)
        } else {
          sfx('wings', position)
          choseLeft = Math.max(choseLeft, 15)
        }
      }),
      bus.on('whale:pass', ({ position }) => {
        sfx('whale', position, 1)
        window.setTimeout(() => sfx('whale', position, 0.7), 6000 + rnd() * 4000)
      }),
      bus.on('ceiling:ripple', ({ x, z, strength }) => sfx('ring', { x, y: CEILING_Y, z }, strength)),
    )
  }

  function updateListener(ctx: GameContext, l: AudioListener, t: number): void {
    const cam = ctx.camera
    const e = cam.matrixWorld.elements
    l.positionX.setTargetAtTime(cam.position.x, t, 0.02)
    l.positionY.setTargetAtTime(cam.position.y, t, 0.02)
    l.positionZ.setTargetAtTime(cam.position.z, t, 0.02)
    l.forwardX.value = -e[8]!
    l.forwardY.value = -e[9]!
    l.forwardZ.value = -e[10]!
    l.upX.value = e[4]!
    l.upY.value = e[5]!
    l.upZ.value = e[6]!
  }

  return {
    id: 'audio',
    init(ctx) {
      game = ctx
      rnd = ctx.rng('audio')
      phase = phaseAt(ctx.state.time.hours)
      ctx.services.audio = service
      wire(ctx)
      window.addEventListener('pointerdown', onGesture, true)
      window.addEventListener('keydown', onGesture, true)
    },
    update(dt, ctx) {
      scrubCooldown -= dt
      groanCooldown -= dt
      if (overrideLeft > 0) {
        overrideLeft -= dt
        if (overrideLeft <= 0) override = null
      }
      if (choseLeft > 0) choseLeft -= dt
      if (dangerLeft > 0) dangerLeft -= dt
      if (!live || live.rig.ctx.state !== 'running') return
      const { rig, music, amb } = live
      const s = ctx.state
      const t = rig.ctx.currentTime

      rig.master.gain.setTargetAtTime(Math.max(0, Math.min(1, s.settings.volume)) * duck, t, 0.3)
      rig.sfxFilter.frequency.setTargetAtTime(s.hero.medium === 'water' ? 4200 : 20000, t, 0.15)
      updateListener(ctx, rig.ctx.listener, t)

      jellyCheck -= dt
      if (jellyCheck <= 0) {
        jellyCheck = 0.5
        const n = s.hero.medium === 'water' ? ctx.services.fauna?.jellyfishNear(s.hero.position, 16) ?? 0 : 0
        if (n > 0) dangerLeft = Math.max(dangerLeft, 6)
      }

      const heading = s.drift.heading
      if (lastHeading !== null && dt > 0) {
        const turn = Math.abs(heading - lastHeading) / dt
        const h = s.hero.position
        const d = s.drift.position
        const near = s.hero.medium === 'air' || Math.hypot(h.x - d.x, h.z - d.z) < 120
        if (turn > 0.01 && turn < 1 && near && groanCooldown <= 0) {
          groanCooldown = 15
          sfx('groan', s.hero.medium === 'air' ? undefined : d, 0.7)
        }
      }
      lastHeading = heading

      const hp = s.hero.position
      const ventD = Math.hypot(hp.x - VENT_UPDRAFT.x, hp.z - VENT_UPDRAFT.z)
      const ventP = Math.max(0, Math.min(1, 1 - (ventD - VENT_UPDRAFT.radius) / 260))
      amb.update(dt, {
        medium: s.hero.medium,
        room: s.hero.room,
        rain: s.env.rain,
        ventProximity: ventP * ventP,
        depth01: Math.max(0, Math.min(1, (CEILING_Y - hp.y) / CEILING_Y)),
      })

      const wanted = override ?? autoCue(ctx)
      if (wanted !== music.cue) music.setCue(wanted)
      music.setMuffled(s.hero.medium === 'water')
      music.update()
    },
    dispose() {
      for (const off of offs.splice(0)) off()
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
      if (live) {
        live.amb.dispose()
        live.rig.ctx.close().catch(() => undefined)
        live = null
      }
      game = null
    },
  }
}
