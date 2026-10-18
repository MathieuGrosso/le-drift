import type { DistrictId } from '../core/types'
import { PLUIE } from './music'
import { crowdAt, inHours, profileFor, type Emitter, type Profile, type Scene } from './places'
import { filter, noise, osc, type Rig } from './rig'
import { playSfx } from './sfx'
import { clap, sing, type Vowel } from './voices'

export interface Listening {
  mode: 'inside' | 'sortie'
  water: boolean
  district: DistrictId
  cell: string | null
  /** 0 on the main deck and above, 1 at the keel. */
  deckDepth: number
  hours: number
  /** 0..1, 1 = face against a window. */
  seaNear: number
  rain: number
  /** Sortie only: 0..1 how close Ilo floats to a window with people behind it. */
  windowNear: number
  taut: boolean
  /** 0..1 how hard the current is tilting the ship: the hull talks more. */
  gite: number
  /** 0..1 the crowd falls quiet, everyone is looking at a window. */
  hush: number
  /** 0..1 how big and open the space around the camera is. */
  air: number
  sleeping: boolean
}

export interface AmbienceHooks {
  /** A spatial destination around the listener; `glass` routes it through the muffled sea bus. */
  place(spread: number, glass: boolean): AudioNode | null
}

export interface Ambience {
  update(dt: number, s: Listening): void
  readonly profile: Profile
  dispose(): void
}

const PLUIE_VOWELS: readonly Vowel[] = ['u', 'i', 'u', 'i', 'a', 'an', 'u', 'i', 'u', 'i', 'a', 'an']

export function createAmbience(rig: Rig, hooks: AmbienceHooks, rnd: () => number): Ambience {
  const c = rig.ctx
  const t0 = c.currentTime
  const sources: AudioScheduledSourceNode[] = []
  const nodes: AudioNode[] = []
  const loop = (kind: 'white' | 'brown' | 'pink') => {
    const s = noise(rig, kind, t0, 0, true)
    sources.push(s)
    return s
  }
  const lfo = (freq: number, depth: number, target: AudioParam) => {
    const o = c.createOscillator()
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.value = depth
    o.connect(g)
    g.connect(target)
    o.start(t0)
    sources.push(o)
  }
  const bus = (dest: AudioNode = rig.amb) => {
    const g = c.createGain()
    g.gain.value = 0
    g.connect(dest)
    nodes.push(g)
    return g
  }

  const hull = bus()
  const hullLp = filter(rig, 'lowpass', 120, 0.9)
  loop('brown').connect(hullLp)
  hullLp.connect(hull)
  lfo(0.05, 40, hullLp.frequency)

  const sea = bus(rig.glass)
  const seaBp = filter(rig, 'bandpass', 320, 0.7)
  const swell = c.createGain()
  swell.gain.value = 0.7
  loop('pink').connect(seaBp)
  seaBp.connect(swell)
  swell.connect(sea)
  lfo(0.11, 0.3, swell.gain)
  lfo(0.037, 120, seaBp.frequency)

  const under = bus()
  const underLp = filter(rig, 'lowpass', 380, 0.8)
  loop('brown').connect(underLp)
  underLp.connect(under)
  lfo(0.06, 120, underLp.frequency)
  const fizz = bus()
  const fizzBp = filter(rig, 'bandpass', 4200, 0.8)
  loop('white').connect(fizzBp)
  fizzBp.connect(fizz)

  const hum = bus()
  const humLp = filter(rig, 'lowpass', 260, 0.8)
  for (const [f, type, lvl] of [[47, 'sine', 0.5], [94, 'sawtooth', 0.08], [141, 'triangle', 0.1], [50.3, 'sine', 0.3]] as const) {
    const o = osc(rig, type, f, t0, 1e6)
    const g = c.createGain()
    g.gain.value = lvl
    o.connect(g)
    g.connect(humLp)
    sources.push(o)
  }
  const humRumble = filter(rig, 'lowpass', 90, 1)
  loop('brown').connect(humRumble)
  humRumble.connect(humLp)
  humLp.connect(hum)

  const crowd = bus()
  const crowdLp = filter(rig, 'lowpass', 1400, 0.5)
  const cSrc = loop('pink')
  const formants: BiquadFilterNode[] = []
  for (const [f, q] of [[480, 2.2], [1050, 3], [2300, 4]] as const) {
    const bp = filter(rig, 'bandpass', f, q)
    cSrc.connect(bp)
    bp.connect(crowdLp)
    formants.push(bp)
  }
  crowdLp.connect(crowd)

  const wind = bus()
  const windBp = filter(rig, 'bandpass', 700, 9)
  loop('white').connect(windBp)
  windBp.connect(wind)
  lfo(0.07, 260, windBp.frequency)
  lfo(0.19, 90, windBp.frequency)

  const trickle = bus()
  const trickleBp = filter(rig, 'bandpass', 2600, 1.6)
  const trickleAm = c.createGain()
  trickleAm.gain.value = 0.6
  loop('white').connect(trickleBp)
  trickleBp.connect(trickleAm)
  trickleAm.connect(trickle)
  lfo(13, 0.35, trickleAm.gain)
  lfo(0.3, 600, trickleBp.frequency)

  const rainGlass = bus(rig.glass)
  const rainLp = filter(rig, 'lowpass', 1500, 0.5)
  loop('white').connect(rainLp)
  rainLp.connect(rainGlass)
  const rainOut = bus()
  const rainHp = filter(rig, 'highpass', 900, 0.5)
  loop('white').connect(rainHp)
  rainHp.connect(rainOut)
  lfo(0.3, 0.02, rainOut.gain)

  let profile: Profile = profileFor('ecluse', 'cabine')
  let profileKey = ''
  const timers = new Map<Emitter, number>()
  const sceneAt = new Map<Scene, number>()
  let wobbleIn = 0
  let crowdLevel = 0
  let pistonAt = 0
  let breatheIn = 2
  let dropIn = 0
  let tautWas = false

  const ease = (p: AudioParam, v: number, tc = 0.8) => p.setTargetAtTime(v, c.currentTime, tc)
  const between = (r: readonly [number, number]) => r[0] + rnd() * (r[1] - r[0])
  const fire = (id: string, amount: number, spread: number, glass: boolean, when = 0) => {
    const dest = hooks.place(spread, glass)
    if (dest) playSfx(rig, dest, id, c.currentTime + 0.02 + when, amount)
  }

  function kidsGame(dest: AudioNode, t: number, vel: number): number {
    const beat = 0.36
    const kids = [0, 0.012, 0.025]
    let at = t
    PLUIE.forEach(([m, b], i) => {
      for (const off of kids) sing(rig, dest, at + off + rnd() * 0.01, m, PLUIE_VOWELS[i]!, vel * 0.35, b * beat * 0.85, true, 0.35)
      clap(rig, dest, at, vel * 0.45)
      if (b >= 1) clap(rig, dest, at + beat * 0.5, vel * 0.3)
      at += b * beat
    })
    const end = at
    for (let i = 0; i < 3; i++) clap(rig, dest, end + i * 0.12, vel * 0.5)
    return end - t + 0.6
  }

  function supperSong(dest: AudioNode, t: number, vel: number): void {
    const beat = 0.75
    let at = t
    PLUIE.forEach(([m, b], i) => {
      const v: Vowel = i % 2 ? 'o' : 'u'
      sing(rig, dest, at, m - 12, v, vel * 0.3, b * beat, false, 0.6)
      sing(rig, dest, at + 0.02, m - 15 - (m % 2), v, vel * 0.2, b * beat, false, 0.6)
      sing(rig, dest, at + 0.01, m, v, vel * 0.15, b * beat, true, 0.6)
      at += b * beat
    })
  }

  function cookHum(dest: AudioNode, t: number, vel: number): void {
    const scale = [50, 52, 54, 57, 59, 62]
    let i = Math.floor(rnd() * 4)
    let at = t
    const n = 5 + Math.floor(rnd() * 5)
    for (let k = 0; k < n; k++) {
      const d = [0.3, 0.45, 0.6, 0.9][Math.floor(rnd() * 4)]!
      sing(rig, dest, at, scale[i]!, k === n - 1 ? 'o' : 'u', vel * 0.3, d, false, 0.2)
      i = Math.max(0, Math.min(scale.length - 1, i + [-1, 1, 1, -2, 2, 0][Math.floor(rnd() * 6)]!))
      at += d + 0.05
    }
  }

  function scenes(s: Listening): void {
    const now = c.currentTime
    for (const sc of profile.scenes) {
      const next = sceneAt.get(sc) ?? now + 2 + rnd() * 6
      if (!sceneAt.has(sc)) sceneAt.set(sc, next)
      if (sc === 'engine-beat') {
        if (pistonAt < now) pistonAt = now + 0.05
        while (pistonAt < now + 0.3) {
          const dest = hooks.place(10, false)
          if (dest) playSfx(rig, dest, 'piston', pistonAt, 0.45 + 0.35 * s.deckDepth)
          pistonAt += 60 / 72
        }
        continue
      }
      if (next > now) continue
      if (sc === 'kids-game' && inHours(s.hours, [8.5, 12])) {
        const dest = hooks.place(s.cell === 'rebord' ? 4 : 12, false)
        const len = dest ? kidsGame(dest, now + 0.1, s.cell === 'rebord' ? 1 : 0.5) : 5
        sceneAt.set(sc, now + len + 6 + rnd() * 18)
      } else if (sc === 'supper-song' && inHours(s.hours, [19.2, 21])) {
        const dest = hooks.place(12, false)
        if (dest) supperSong(dest, now + 0.1, 0.9)
        sceneAt.set(sc, now + 30 + rnd() * 50)
      } else if (sc === 'cook-hum' && inHours(s.hours, [5.5, 21])) {
        const dest = hooks.place(4, false)
        if (dest) cookHum(dest, now + 0.1, 1)
        sceneAt.set(sc, now + 25 + rnd() * 40)
      } else {
        sceneAt.set(sc, now + 20)
      }
    }
  }

  return {
    get profile() {
      return profile
    },
    update(dt, s) {
      const key = `${s.district}|${s.cell ?? ''}`
      if (key !== profileKey) {
        profileKey = key
        profile = profileFor(s.district, s.cell)
        timers.clear()
        sceneAt.clear()
      }
      const outside = s.mode === 'sortie' || s.water
      const deep = s.deckDepth

      ease(rig.roomSend.gain, outside ? 0.2 : profile.room * (1 - 0.6 * s.air), 1)
      ease(rig.hallSend.gain, outside ? 0.9 : Math.max(profile.hall, s.air), 1)
      ease(rig.amb.gain, s.sleeping ? 0.3 : 0.85, s.sleeping ? 3 : 1.5)
      ease(rig.glassTone.frequency, outside ? 1600 : 280 + 1100 * s.seaNear, 0.6)
      ease(rig.glass.gain, outside ? 0.5 : 0.18 + 0.65 * s.seaNear, 0.6)

      ease(hull.gain, outside ? 0 : 0.22 + 0.12 * deep)
      ease(sea.gain, outside ? 0 : 0.25 + 0.6 * s.seaNear)
      ease(under.gain, outside ? 0.42 : 0)
      ease(fizz.gain, outside ? 0.016 : 0)
      ease(hum.gain, outside ? 0.03 : profile.hum * 0.3 + 0.08 * deep, 1.2)
      ease(wind.gain, outside ? 0 : profile.wind * 0.05, 1.5)
      ease(trickle.gain, outside ? 0 : profile.trickle * 0.035, 1.2)
      ease(rainGlass.gain, outside ? 0 : 0.18 * s.rain * (0.25 + s.seaNear), 1.5)
      ease(rainOut.gain, outside ? 0.06 * s.rain : 0, 1.5)

      crowdLevel = outside ? 0 : profile.crowd * crowdAt(s.hours, s.cell, profile.flavor) * (1 - 0.85 * s.hush)
      wobbleIn -= dt
      if (wobbleIn <= 0) {
        wobbleIn = 0.15 + rnd() * 0.3
        ease(crowd.gain, 0.12 * crowdLevel * (0.55 + rnd() * 0.6), 0.09)
        formants[0]!.frequency.setTargetAtTime(380 + rnd() * 260, c.currentTime, 0.1)
        formants[1]!.frequency.setTargetAtTime(900 + rnd() * 500, c.currentTime, 0.1)
      }

      if (!outside) {
        for (const e of profile.emitters) {
          if (!inHours(s.hours, e.hours)) continue
          let left = timers.get(e)
          if (left === undefined) left = between(e.every) * (0.3 + rnd() * 0.7)
          left -= dt
          if (left <= 0) {
            const hull = e.id === 'creak' || e.id === 'hull-tick' || e.id === 'groan' ? 1 + 3 * s.gite : 1
            left = between(e.every) / (e.crowd ? Math.max(0.15, crowdLevel) : hull)
            if (!e.crowd || rnd() < Math.min(1, crowdLevel * 1.3)) {
              fire(e.id, e.amount ? between(e.amount) : 0.6, e.spread ?? 10, e.glass ?? false)
            }
          }
          timers.set(e, left)
        }
        scenes(s)
        if (s.seaNear > 0.2 && rnd() < dt / 40) fire(rnd() < 0.7 ? 'fish' : 'bubbles', 0.4 * s.seaNear, 6, true)
      } else {
        breatheIn -= dt
        if (breatheIn <= 0) {
          breatheIn = 3.8 + rnd() * 1.6
          fire('breathe', 0.8, 0.5, false)
        }
        if (rnd() < dt / 9) fire('hull-tick', 0.3 + rnd() * 0.4, 8, false)
        if (rnd() < dt / 14) fire('bubbles', 0.2 + rnd() * 0.3, 10, false)
        if (rnd() < dt / 20) fire('fish', 0.4, 12, false)
        if (s.windowNear > 0.3 && rnd() < dt * s.windowNear / 4) {
          fire(rnd() < 0.75 ? 'voices' : 'laugh', 0.4 * s.windowNear, 3, true)
        }
        if (s.taut && !tautWas) fire('rope-taut', 0.8, 1, false)
      }
      tautWas = s.taut

      if (s.rain > 0.02) {
        dropIn -= dt
        if (dropIn <= 0) {
          dropIn = (0.05 + rnd() * 0.25) / Math.max(0.15, s.rain)
          fire(outside ? 'rain-drop' : 'ring', 0.3 + rnd() * 0.5 * s.rain, 10, !outside)
        }
      }
    },
    dispose() {
      for (const s of sources) {
        try {
          s.stop()
        } catch {
          /* already stopped */
        }
      }
      for (const n of nodes) n.disconnect()
    },
  }
}
