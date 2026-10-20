import { CEILING_Y, DRIFT_BOUNDS } from '../core/layout'
import { phaseAt } from '../core/state'
import type { AudioService, DayPhase, DistrictId, GameContext, HeroMode, MusicCue, System, Vec3 } from '../core/types'
import { createAmbience, type Ambience, type Listening } from './ambience'
import { createMusicDirector, normalizeCue, type Cue, type MusicDirector } from './music'
import { createRig, DRY, type Rig } from './rig'
import { playSfx, playStep, type StepSurface } from './sfx'
import { babble, voiceOf } from './voices'

const OVERRIDE_TTL: Partial<Record<Cue, number>> = {
  home: 60, dome: 12, vista: 45, scellee: 600, danger: 20, night: 60, wonder: 45, sortie: 600, rain: 1e9, silence: 1e9,
}
const SPATIAL_MAX = 260
// Sounds that live in the sea: from inside they are heard through glass.
const SEA_IDS = new Set(['whale', 'bird', 'wings', 'ring', 'rain-drop', 'fish', 'chose-pass', 'splash', 'bubbles'])
const ENERGY: Partial<Record<string, number>> = {
  run: 1, climb: 1, ladder: 0.8, zip: 1, tube: 1, slide: 1, swim: 0.7, jump: 0.9, fall: 0.9, walk: 0.4, scrub: 0.5,
}
const GLASS_CELLS: Partial<Record<string, number>> = { refectoire: 0.7, rebord: 1, sas: 0.6, 'salle-des-cartes': 0.6, cabine: 0.4 }

type Payload = Record<string, unknown>
interface LooseBus { on(k: string, fn: (p: Payload) => void): () => void }

const num = (p: Payload, k: string, d = 0) => (typeof p[k] === 'number' ? (p[k] as number) : d)
const str = (p: Payload, k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
// ?mute never creates an AudioContext, so nothing downstream can reach the speakers.
const MUTED = new URLSearchParams(location.search).has('mute')

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

  let override: Cue | null = null
  let overrideLeft = 0
  let phase: DayPhase = 'jour'
  let scelleeId: string | null = null
  let choseLeft = 0
  let dangerLeft = 0
  let tautLeft = 0
  let duck = 1
  let scrubCooldown = 0
  let waterCooldown = 0
  let lastHeading: number | null = null
  let groanCooldown = 0
  let windowCheck = 0
  let windowNear = 0
  let energy = 0
  let lastSurface: StepSurface = 'bois'
  let gite = 0
  let groanGite = 0
  let hushLeft = 0
  let sleeping = false
  let pantIn = 0
  let heartIn = 0
  let air = 0
  let vistaCell: string | null = null
  const vistaAt = new Map<string, number>()
  const warned = new Set<string>()

  const drift = () => game?.services.drift
  const isOutsideShip = (p: Vec3): boolean => {
    const d = drift()
    if (!d) return false
    const l = d.toLocal(p)
    const m = 2
    return l.x < DRIFT_BOUNDS.x0 - m || l.x > DRIFT_BOUNDS.x1 + m || l.z < DRIFT_BOUNDS.z0 - m || l.z > DRIFT_BOUNDS.z1 + m
      || l.y < DRIFT_BOUNDS.y0 - m || l.y > DRIFT_BOUNDS.y1 + m
  }

  function spatial(p: Vec3, glass: boolean): AudioNode | null {
    if (!live) return null
    const { rig } = live
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
    pan.refDistance = glass ? 10 : 5
    pan.maxDistance = SPATIAL_MAX
    pan.rolloffFactor = glass ? 0.7 : 1.1
    pan.positionX.value = p.x
    pan.positionY.value = p.y
    pan.positionZ.value = p.z
    pan.connect(glass ? rig.glass : rig.sfx)
    if (glass) DRY.add(pan)
    window.setTimeout(() => pan.disconnect(), 14000)
    return pan
  }

  function around(spread: number, glass: boolean): AudioNode | null {
    if (!live) return null
    const cam = game?.camera.position
    if (!cam) return glass ? live.rig.glass : live.rig.amb
    const a = rnd() * Math.PI * 2
    const r = spread * (0.35 + rnd() * 0.65)
    return spatial({ x: cam.x + Math.cos(a) * r, y: cam.y + (rnd() - 0.4) * Math.min(4, spread * 0.3), z: cam.z + Math.sin(a) * r }, glass)
  }

  function play(id: string, dest: AudioNode | null, amount: number, delay = 0): void {
    if (!live || !dest || live.rig.ctx.state !== 'running') return
    if (!playSfx(live.rig, dest, id, live.rig.ctx.currentTime + 0.01 + delay, amount) && !warned.has(id)) {
      warned.add(id)
      console.warn(`[audio] unknown sfx "${id}"`)
    }
  }

  function sfx(id: string, p?: Vec3, amount = 1): void {
    if (!live || live.rig.ctx.state !== 'running') return
    const inside = game?.state.mode !== 'sortie' && game?.state.hero.medium !== 'water'
    const sea = SEA_IDS.has(id) && (!p || isOutsideShip(p))
    const glass = inside ? sea : !SEA_IDS.has(id) && !!p && !isOutsideShip(p) && !!drift()?.cellAt(drift()!.toLocal(p))
    if (!p) {
      play(id, glass ? around(14, true) : live.rig.sfx, amount)
      return
    }
    play(id, spatial(p, glass), amount)
  }

  function cue(c: MusicCue | string): void {
    const n = normalizeCue(c)
    if (n === 'explore') {
      override = null
      overrideLeft = 0
      return
    }
    if (n === 'dome') {
      live?.music.stinger('dome')
      override = 'vista'
      overrideLeft = OVERRIDE_TTL.vista ?? 45
      return
    }
    override = n
    overrideLeft = OVERRIDE_TTL[n] ?? 30
  }

  function autoCue(ctx: GameContext): Cue {
    const s = ctx.state
    if (sleeping) return 'silence'
    if (s.env.rain > 0.3) return 'rain'
    if (choseLeft > 0) return 'wonder'
    if (scelleeId) return 'scellee'
    if (dangerLeft > 0) return 'danger'
    if (s.mode === 'sortie') return phase === 'nuit' ? 'night' : 'sortie'
    const env = ctx.services.drift?.cameraEnv()
    const district = env?.district ?? s.hero.district
    const cell = env?.cell ?? s.hero.room
    const h = ((s.time.hours % 24) + 24) % 24
    if (phase === 'nuit' && district !== 'marche') return 'night'
    if (district === 'ecluse' && (cell === 'refectoire' || cell === 'rebord' || cell === 'cuisine' || h < 9)) return 'home'
    return 'explore'
  }

  function build(ctx: AudioContext): Live {
    const rig = createRig(ctx)
    const music = createMusicDirector(rig, rnd)
    if (game) music.setAct(game.state.act)
    const amb = createAmbience(rig, { place: (spread, glass) => around(spread, glass) }, rnd)
    return { rig, music, amb }
  }

  function unlock(): Promise<void> {
    if (MUTED) return Promise.resolve()
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

  function stepSurface(ctx: GameContext, reported: StepSurface): StepSurface {
    const mode = ctx.state.hero.mode as string
    const floor = live?.amb.profile.floor ?? 'bois'
    if (reported === 'tapis' && (mode === 'climb' || mode === 'ladder')) return 'corde'
    if (mode === 'ladder' || mode === 'climb') return 'echelle'
    if (reported === 'sable' || reported === 'bois') return floor === 'echelle' ? 'metal' : floor
    if (reported === 'metal' && floor === 'grille') return 'grille'
    return reported
  }

  function onLock(p: Payload): void {
    const at = game?.state.hero.position
    const ph = str(p, 'phase')
    const out = str(p, 'dir') === 'out'
    if (ph === 'close') {
      sfx('hatch', at)
      sfx('lock-clang', at, 0.8)
    } else if (ph === 'pump') {
      sfx(out ? 'water-rush' : 'pump', at)
      if (!out) sfx('pump', at, 0.6)
    } else if (ph === 'open') {
      sfx('lock-clang', at)
      sfx('sas', at, out ? 0.8 : 0.4)
    }
  }

  function greet(npcId: string, vel: number, chars = 30): void {
    if (!live || live.rig.ctx.state !== 'running' || !npcId) return
    const v = voiceOf(npcId)
    const at = around(1.5, false)
    if (!at) return
    const t = live.rig.ctx.currentTime + 0.03
    const syll = Math.max(2, Math.min(7, Math.round(chars / 12)))
    babble(live.rig, at, t, vel * v.vel, v.pitch, v.child, syll, v.pace)
  }

  function ooh(amount: number, delay: number): void {
    if (!live || game?.state.mode !== 'inside') return
    const crowd = live.amb.profile.crowd
    if (crowd < 0.3) return
    play('crowd-ooh', around(10, false), amount * Math.min(1, crowd), delay)
  }

  function wire(ctx: GameContext): void {
    const bus = ctx.bus
    const loose = bus as unknown as LooseBus
    const hero = () => ctx.state.hero.position
    offs.push(
      bus.on('audio:cue', ({ cue: c }) => cue(c)),
      bus.on('time:phase', ({ phase: p }) => {
        phase = p
      }),
      bus.on('time:hour', ({ hour }) => {
        const h = ((hour % 24) + 24) % 24
        if ((h === 6 || h === 12 || h === 19) && ctx.state.mode === 'inside') play('clock-bell', around(60, false), 0.35)
      }),
      bus.on('game:paused', ({ paused }) => {
        duck = paused ? 0.35 : 1
        if (live) live.rig.master.gain.setTargetAtTime(ctx.state.settings.volume * duck, live.rig.ctx.currentTime, 0.2)
      }),
      bus.on('hero:kick', () => sfx('kick', undefined, 0.8)),
      bus.on('hero:landed', ({ speed }) => {
        const a = Math.min(1, speed / 6)
        if (a < 0.15 || !live) return
        sfx('land', undefined, a)
        playStep(live.rig, live.rig.sfx, live.rig.ctx.currentTime + 0.01, lastSurface, ctx.state.hero.wetness > 0.1, 1.3)
      }),
      bus.on('hero:breathEmpty', () => {
        if (ctx.state.mode === 'sortie' || ctx.state.hero.medium === 'water') sfx('breath-empty')
        else {
          sfx('pant', undefined, 0.9)
          pantIn = 2
        }
      }),
      bus.on('hero:breathFull', () => sfx('breath-full')),
      bus.on('hero:stung', () => {
        sfx('sting')
        dangerLeft = Math.max(dangerLeft, 15)
      }),
      bus.on('hero:medium', ({ medium }) => sfx(medium === 'water' ? 'splash' : 'sas', undefined, 0.4)),
      bus.on('hero:mode', ({ to }) => {
        const m = to as HeroMode | 'zip' | 'tube' | 'slide' | 'run'
        if (to !== 'sleep') sleeping = false
        if (m === 'ladder') sfx('ladder-grab')
        else if (m === 'climb') sfx('grip')
        else if ((m as string) === 'jump') sfx('jump', undefined, 0.8)
        else if (m === 'sit') sfx('sit')
        else if (m === 'sleep') {
          sfx('bed')
          sleeping = true
        }
        else if (m === 'swim') sfx('bubbles', undefined, 0.5)
        else if (m === 'zip') sfx('zip')
        else if (m === 'tube') sfx('tube')
        else if (m === 'slide') sfx('slide')
        else if (m === 'exhausted') sfx('breath-empty', undefined, 0.6)
      }),
      bus.on('hero:step', ({ surface, wet }) => {
        if (!live || live.rig.ctx.state !== 'running') return
        lastSurface = stepSurface(ctx, surface)
        const loud = (ctx.state.hero.mode as string) === 'run' ? 1.25 : 1
        playStep(live.rig, live.rig.sfx, live.rig.ctx.currentTime + 0.005, lastSurface, wet, loud)
      }),
      bus.on('airlock:cycle', (p) => onLock(p as unknown as Payload)),
      loose.on('lock:cycle', onLock),
      bus.on('door:changed', ({ open }) => sfx(open ? 'door' : 'hatch-clang', hero(), open ? 1 : 0.4)),
      loose.on('door:locked', () => sfx('door-rattle', hero(), 0.8)),
      bus.on('dialogue:start', ({ npcId }) => greet(npcId, 1)),
      loose.on('dialogue:line', (p) => greet(str(p, 'npcId'), 0.7, num(p, 'chars', 40))),
      bus.on('act:changed', ({ act }) => live?.music.setAct(act)),
      bus.on('time:phase', ({ phase: p }) => {
        if (p !== 'aube' || ctx.state.mode !== 'inside' || sleeping) return
        live?.music.stinger('aube')
        if (ctx.state.hero.district === 'ecluse') play('forecast', around(6, false), 0.6, 2)
      }),
      bus.on('interact', ({ kind }) => {
        const k = kind as string
        const map: Record<string, string> = {
          seat: 'sit', bed: 'bed', hammock: 'bed', 'chart-table': 'stylo', ladder: 'ladder-grab', stall: 'coins',
          marmite: 'pot', valve: 'valve', pump: 'pump', lever: 'lever', ring: 'tether-clip', lunette: 'paper',
          window: 'glass-tap',
        }
        const id = map[k]
        if (id) sfx(id, undefined, 0.8)
      }),
      bus.on('sortie:start', () => sfx('tether-clip')),
      bus.on('sortie:end', ({ scrubbed }) => {
        if (scrubbed >= 3) live?.music.stinger('decouverte')
      }),
      bus.on('tether:taut', () => {
        tautLeft = 1.5
      }),
      loose.on('tether:clip', () => sfx('tether-clip')),
      bus.on('scrub:progress', () => {
        if (scrubCooldown > 0) return
        scrubCooldown = 0.14 + rnd() * 0.12
        sfx('scrub', undefined, 0.6 + rnd() * 0.4)
      }),
      bus.on('scrub:done', () => {
        sfx('scrub-done')
        if (ctx.state.mode !== 'sortie' || !live) return
        const h = ((ctx.state.time.hours % 24) + 24) % 24
        if (h > 6 && h < 22 && rnd() < 0.45) {
          play('glass-tap', around(2, true), 0.9, 0.6)
          if (rnd() < 0.6) play(rnd() < 0.5 ? 'kid-call' : 'laugh', around(3, true), 0.8, 1.1)
        }
      }),
      bus.on('sonde:activated', () => {
        sfx('dome')
        cue('dome')
      }),
      loose.on('dome:activated', () => {
        sfx('dome')
        cue('dome')
      }),
      bus.on('shallow:entered', ({ id }) => {
        scelleeId = id
      }),
      loose.on('scellee:entered', (p) => {
        scelleeId = str(p, 'id') || 'scellee'
      }),
      bus.on('shallow:completed', () => {
        scelleeId = null
        live?.music.stinger('scellee')
      }),
      loose.on('scellee:completed', () => {
        scelleeId = null
        live?.music.stinger('scellee')
      }),
      loose.on('zip:start', () => sfx('zip')),
      loose.on('zip:end', () => sfx('zip-end')),
      loose.on('tube:travel', () => sfx('tube')),
      loose.on('valve:changed', () => sfx('valve', hero())),
      loose.on('water:level', () => {
        if (waterCooldown > 0) return
        waterCooldown = 3
        sfx('water-rush', hero(), 0.5)
      }),
      loose.on('gite:changed', (p) => {
        const mag = Math.abs(num(p, 'roll')) + Math.abs(num(p, 'pitch'))
        gite = clamp01(mag / 0.07)
        if (groanCooldown > 0 || Math.abs(mag - groanGite) < 0.015) return
        groanGite = mag
        groanCooldown = 10
        sfx('groan', undefined, clamp01(0.4 + mag * 8))
        play('creak', around(8, false), 0.8, 1.2)
      }),
      loose.on('drift:altitude', () => {
        if (waterCooldown > 0) return
        waterCooldown = 8
        sfx('ballast', undefined, 0.7)
        sfx('groan', undefined, 0.6)
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
          sfx('chose-pass', position, 0.8)
          choseLeft = 40
          hushLeft = 25
        } else if (p === 'grab') {
          sfx('splash', position, 0.6)
          choseLeft = Math.max(choseLeft, 20)
          ooh(0.9, 0.4)
        } else {
          sfx('wings', position)
          choseLeft = Math.max(choseLeft, 15)
        }
      }),
      bus.on('whale:pass', ({ position }) => {
        sfx('whale', position, 1)
        window.setTimeout(() => sfx('whale', position, 0.7), 6000 + rnd() * 4000)
        if (ctx.state.mode === 'inside') {
          window.setTimeout(() => play('hull-tick', around(6, false), 0.6), 2500)
          hushLeft = Math.max(hushLeft, 10)
          ooh(0.7, 3)
        }
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

  function listening(ctx: GameContext, dt: number): Listening {
    const s = ctx.state
    const d = ctx.services.drift
    const env = d?.cameraEnv()
    const district: DistrictId = env?.district ?? s.hero.district
    const cell = env?.cell ?? s.hero.room
    const seaNear = env && env.indoor > 0.5
      ? clamp01(1 - (env.glassDist - 1) / 12)
      : GLASS_CELLS[cell ?? ''] ?? 0.1
    const localY = s.hero.localPosition?.y ?? 0
    air += ((env?.airHaze ?? 0) - air) * Math.min(1, dt * 0.8)
    if (env && env.airHaze >= 0.6 && env.cell && env.cell !== vistaCell && s.mode === 'inside') {
      const last = vistaAt.get(env.cell) ?? -1e9
      if (ctx.clock.elapsed - last > 480 && !override) {
        vistaAt.set(env.cell, ctx.clock.elapsed)
        override = 'vista'
        overrideLeft = OVERRIDE_TTL.vista ?? 45
      }
    }
    vistaCell = env && env.airHaze >= 0.6 ? env.cell : null
    windowCheck -= dt
    if (windowCheck <= 0) {
      windowCheck = 0.5
      const w = s.mode === 'sortie' ? d?.nearestWindow(s.hero.position, 5) ?? null : null
      windowNear = w ? clamp01(1 - Math.hypot(w.position.x - s.hero.position.x, w.position.y - s.hero.position.y, w.position.z - s.hero.position.z) / 5) : 0
    }
    return {
      mode: s.mode,
      water: s.hero.medium === 'water',
      district,
      cell,
      deckDepth: clamp01(-localY / 22),
      hours: s.time.hours,
      seaNear,
      rain: s.env.rain,
      windowNear,
      taut: tautLeft > 0,
      gite,
      hush: clamp01(hushLeft / 8),
      air,
      sleeping,
    }
  }

  return {
    id: 'audio',
    init(ctx) {
      game = ctx
      rnd = ctx.rng('audio')
      phase = phaseAt(ctx.state.time.hours)
      sleeping = ctx.state.hero.mode === 'sleep'
      ctx.services.audio = service
      wire(ctx)
      window.addEventListener('pointerdown', onGesture, true)
      window.addEventListener('keydown', onGesture, true)
    },
    update(dt, ctx) {
      scrubCooldown -= dt
      groanCooldown -= dt
      waterCooldown -= dt
      tautLeft -= dt
      if (hushLeft > 0) hushLeft -= dt
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
      const wet = s.hero.medium === 'water'

      rig.master.gain.setTargetAtTime(clamp01(s.settings.volume) * duck, t, 0.3)
      rig.sfxFilter.frequency.setTargetAtTime(wet ? 4200 : 20000, t, 0.15)
      updateListener(ctx, rig.ctx.listener, t)

      const heading = s.drift.heading
      if (lastHeading !== null && dt > 0) {
        const turn = Math.abs(heading - lastHeading) / dt
        if (turn > 0.01 && turn < 1 && groanCooldown <= 0) {
          groanCooldown = 15
          sfx('groan', undefined, s.mode === 'sortie' ? 0.4 : 0.7)
        }
      }
      lastHeading = heading

      const hm = s.hero.mode as string
      const low = s.hero.breathMax > 0 ? s.hero.breath / s.hero.breathMax : 1
      const indoorsAir = s.mode === 'inside' && !wet
      pantIn -= dt
      if (indoorsAir && (hm === 'exhausted' || s.hero.exhausted) && pantIn <= 0) {
        pantIn = 1.9 + rnd() * 0.4
        sfx('pant', undefined, 0.7)
      }
      heartIn -= dt
      if (low < 0.3 && (hm === 'climb' || hm === 'run' || hm === 'exhausted' || hm === 'swim') && heartIn <= 0) {
        heartIn = 0.55 + low
        play('heartbeat', rig.sfx, 0.4 + (0.3 - low) * 2)
      }

      const l = listening(ctx, dt)
      amb.update(dt, l)
      music.setFlavor(amb.profile.flavor)
      energy += ((ENERGY[s.hero.mode] ?? 0) - energy) * Math.min(1, dt * 0.5)
      music.setEnergy(energy)
      music.setMuffled(wet)
      const wanted = sleeping ? 'silence' : override ?? autoCue(ctx)
      if (wanted !== music.cue) music.setCue(wanted)
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
