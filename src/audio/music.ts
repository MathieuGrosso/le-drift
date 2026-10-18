import type { MusicCue } from '../core/types'
import type { Flavor } from './places'
import { filter, type Rig } from './rig'
import { bass, bell, choir, clap, flute, marimba, pad, piano, pluck, tick } from './voices'

const D_PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86] as const
const B_MIN_PENT = [59, 62, 64, 66, 69, 71, 74, 76, 78, 81] as const
const NIGHT = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95] as const

// « Pluie, pluie, va-t'en » : the clapping game on the sill. [midi, beats]
export const PLUIE: readonly (readonly [number, number])[] = [
  [69, 1], [66, 1], [69, 0.5], [69, 0.5], [66, 1],
  [69, 0.5], [69, 0.5], [66, 0.5], [66, 0.5], [71, 0.5], [69, 0.5], [66, 1],
]

export type Cue = Exclude<MusicCue, 'sonde' | 'shallow' | 'drift'> | 'home' | 'dome' | 'scellee' | 'sortie' | 'vista'

export function normalizeCue(c: string): Cue {
  if (c === 'sonde') return 'dome'
  if (c === 'shallow') return 'scellee'
  if (c === 'drift') return 'home'
  const known: readonly string[] = ['explore', 'danger', 'night', 'wonder', 'rain', 'silence', 'home', 'dome', 'scellee', 'sortie', 'vista']
  return (known.includes(c) ? c : 'explore') as Cue
}

interface Lane {
  cue: Cue
  gain: GainNode
  tone: BiquadFilterNode
  nextAt: number
  phrase: number
}

type Rand = () => number

export interface MusicDirector {
  readonly cue: Cue
  setCue(c: Cue): void
  setMuffled(m: boolean): void
  setFlavor(f: Flavor): void
  /** 0 = standing still, 1 = running, climbing, sliding. */
  setEnergy(e: number): void
  stinger(kind: 'dome' | 'trouvaille' | 'decouverte' | 'reveil' | 'scellee'): void
  update(): void
}

export function createMusicDirector(rig: Rig, rnd: Rand): MusicDirector {
  const c = rig.ctx
  let lane: Lane | null = null
  let muffled = false
  let lastExplore: number[] = []
  let cue: Cue = 'silence'
  let flavor: Flavor = 'home'
  let energy = 0

  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!
  const range = (a: number, b: number) => a + rnd() * (b - a)

  function openLane(next: Cue): Lane {
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(1, c.currentTime + (next === 'vista' ? 3 : 1.5))
    const tone = filter(rig, 'lowpass', 16000, 0.5)
    gain.connect(tone)
    tone.connect(rig.music)
    const firstDelay = next === 'explore' || next === 'sortie' ? range(3, 8) : next === 'night' ? range(2, 5) : next === 'vista' ? 7 : 0.3
    return { cue: next, gain, tone, nextAt: c.currentTime + firstDelay, phrase: 0 }
  }

  function closeLane(l: Lane, fade: number): void {
    const now = c.currentTime
    l.gain.gain.cancelScheduledValues(now)
    l.gain.gain.setValueAtTime(l.gain.gain.value, now)
    l.gain.gain.linearRampToValueAtTime(0, now + fade)
    window.setTimeout(() => {
      l.gain.disconnect()
      l.tone.disconnect()
    }, (fade + 0.5) * 1000)
  }

  function applyMuffle(l: Lane): void {
    const target = muffled ? (l.cue === 'sortie' ? 5000 : 650) : 16000
    l.tone.frequency.setTargetAtTime(target, c.currentTime, 0.6)
  }

  function walk(scale: readonly number[], n: number, startIdx: number): number[] {
    const out: number[] = []
    let i = startIdx
    for (let k = 0; k < n; k++) {
      out.push(scale[i]!)
      const step = pick([-2, -1, -1, 1, 1, 2, 0])
      i = Math.max(0, Math.min(scale.length - 1, i + step))
    }
    return out
  }

  function voice(dest: AudioNode, t: number, m: number, vel: number, last: boolean): void {
    switch (flavor) {
      case 'market':
        marimba(rig, dest, t, m, vel)
        if (rnd() < 0.3) pluck(rig, dest, t, m + 12, vel * 0.4)
        break
      case 'garden':
        marimba(rig, dest, t, m, vel * 0.8, 0.6)
        if (last) bell(rig, dest, t, m + 12, 0.2, 3)
        break
      case 'nave':
      case 'heights':
        if (last || rnd() < 0.3) flute(rig, dest, t, m, vel * 0.9, last ? 2.5 : 1)
        else piano(rig, dest, t, m, vel, 4, 0.7)
        break
      case 'engine':
        piano(rig, dest, t, m - 12, vel, 3, 0.5)
        break
      case 'workshop':
        pluck(rig, dest, t, m, vel, 1.2)
        break
      default:
        piano(rig, dest, t, m, vel, last ? 5 : 3)
    }
  }

  function explore(l: Lane, t: number): number {
    const beat = 60 / (flavor === 'market' || flavor === 'workshop' ? 80 : 66)
    let notes: number[]
    const minorish = flavor === 'engine' || flavor === 'prow' || flavor === 'sealed'
    if (lastExplore.length > 0 && rnd() < 0.25) {
      notes = lastExplore.map((m) => m + pick([0, 0, 5, -5, 7]))
    } else {
      const minor = minorish ? rnd() < 0.8 : rnd() < 0.3
      notes = walk(minor ? B_MIN_PENT : D_PENT, Math.floor(range(3, 8)), Math.floor(range(2, 6)))
      if (rnd() < 0.4) lastExplore = notes
    }
    if (flavor === 'engine') {
      for (let i = 0; i < 8; i++) bass(rig, l.gain, t + i * beat * 0.5, i % 4 === 3 ? 42 : 35, 0.4, 0.6)
    } else if (rnd() < 0.45) bass(rig, l.gain, t, pick([38, 43, 45, 47]), 0.5, 6)
    if (flavor === 'nave' && rnd() < 0.5) pad(rig, l.gain, t, [50, 57, 64, 69], 0.4, 3, 4, 5, 900, 0.8)
    if (flavor === 'heights') pad(rig, l.gain, t, [62, 69, 76], 0.25, 4, 3, 5, 1400, 0.9)
    let at = t
    notes.forEach((m, i) => {
      const last = i === notes.length - 1
      const d = last ? 2 : pick([0.5, 0.75, 1, 1, 1.5])
      voice(l.gain, at + range(-0.02, 0.03), m, range(0.3, 0.6), last)
      if (flavor === 'market' && i % 2 === 0) tick(rig, l.gain, at, 0.35)
      if (rnd() < 0.15) piano(rig, l.gain, at + 0.01, m - 12, 0.25, 3)
      at += d * beat
    })
    const gap = range(18, 55) * (1.3 - 0.6 * energy)
    return at - t + gap
  }

  function sortie(l: Lane, t: number): number {
    const chords = [[50, 57, 64], [47, 54, 62], [43, 50, 59, 66], [45, 52, 61]] as const
    const ch = chords[l.phrase % chords.length]!
    pad(rig, l.gain, t, ch, 0.45, 4, 4, 6, 700, 0.8)
    const top = walk(NIGHT, Math.floor(range(3, 6)), Math.floor(range(0, 4)))
    top.forEach((m, i) => bell(rig, l.gain, t + 2 + i * range(1.2, 2.2), m - 12, range(0.2, 0.35), 4, 2, 0.9))
    if (rnd() < 0.5) flute(rig, l.gain, t + 6, pick([69, 71, 74]), 0.5, 3.5)
    l.phrase++
    return 14 + range(4, 16)
  }

  function vista(l: Lane, t: number): number {
    pad(rig, l.gain, t, [50, 57, 62, 66, 69], 0.7, 4, 8, 8, 1300, 0.9)
    choir(rig, l.gain, t + 3, [62, 69, 74], 0.35, 4, 5, 6)
    const mel = [74, 76, 78, 81, 78, 76, 74, 69]
    mel.forEach((m, i) => flute(rig, l.gain, t + 2 + i * 1.5, m, 0.6, i === mel.length - 1 ? 4 : 1.3))
    bass(rig, l.gain, t, 38, 0.5, 10)
    l.phrase++
    return l.phrase > 1 ? 1e6 : 22
  }

  function drift(l: Lane, t: number): number {
    const beat = 60 / 84
    const variant = l.phrase % 3
    const chords = [[50, 57, 62, 66], [43, 55, 59, 62], [45, 57, 61, 64]] as const
    pad(rig, l.gain, t, chords[l.phrase % chords.length]!, 0.7, 2, 4, 3, 1100, 0.4)
    let at = t + beat
    const notes = variant === 2 ? PLUIE.slice(0, 5) : PLUIE
    for (const [m, b] of notes) {
      piano(rig, l.gain, at, m + (variant === 1 ? 12 : 0), 0.45, 2.2, 0.3)
      if (b >= 1 || rnd() < 0.5) clap(rig, l.gain, at, 0.25)
      at += b * beat
    }
    l.phrase++
    return at - t + range(8, 20)
  }

  function shallow(l: Lane, t: number): number {
    const beat = 60 / 92
    const base = [59, 66, 62, 69, 64, 66, 62, 71] as const
    const bars = 4
    for (let b = 0; b < bars; b++) {
      for (let s = 0; s < 8; s++) {
        const at = t + (b * 8 + s) * beat * 0.5
        if (rnd() < 0.15) continue
        const m = base[s]! + (b === 2 && s % 4 === 3 ? 2 : 0)
        pluck(rig, l.gain, at, m + 12, s % 4 === 0 ? 0.55 : 0.35)
        if (s % 2 === 1) tick(rig, l.gain, at, 0.4)
      }
      if (b % 2 === 0) bass(rig, l.gain, t + b * 8 * beat * 0.5, pick([35, 38, 40]), 0.45, 3)
    }
    l.phrase++
    return bars * 4 * beat + (l.phrase % 3 === 0 ? 2 * beat * 4 : 0)
  }

  function danger(l: Lane, t: number): number {
    for (let i = 0; i < 4; i++) bass(rig, l.gain, t + i * 1.4, 35, 0.6, 1.2)
    bell(rig, l.gain, t + 0.7, 84, 0.35, 3, 2.76)
    bell(rig, l.gain, t + 2.8, 90, 0.3, 3, 2.76)
    pad(rig, l.gain, t, [47, 48, 54], 0.5, 1.5, 2, 2, 500, 0.3)
    return 5.6 + range(1.5, 4)
  }

  function night(l: Lane, t: number): number {
    const notes = walk(NIGHT, Math.floor(range(4, 9)), Math.floor(range(1, 6)))
    let at = t
    for (const m of notes) {
      bell(rig, l.gain, at, m, range(0.35, 0.6), 3.2, rnd() < 0.5 ? 3.5 : 2.76, 0.7)
      at += pick([0.4, 0.6, 0.9, 1.3])
    }
    if (rnd() < 0.5) pad(rig, l.gain, t, [50, 57, 64], 0.35, 3, 2, 4, 700, 0.7)
    return at - t + range(10, 30)
  }

  function wonder(l: Lane, t: number): number {
    const prog = [[50, 54, 57, 61], [47, 50, 54, 61], [43, 59, 62, 66, 73], [45, 52, 62, 69]] as const
    prog.forEach((ch, i) => choir(rig, l.gain, t + i * 5, ch, 0.8, 2.5, 3, 3))
    pad(rig, l.gain, t, [38, 45], 0.5, 4, 12, 6, 600)
    const top = walk(D_PENT, 6, 7)
    top.forEach((m, i) => piano(rig, l.gain, t + 2 + i * range(2.2, 3.4), m + 12, 0.3, 4, 0.7))
    return 22 + range(4, 8)
  }

  function rain(l: Lane, t: number): number {
    const beat = 60 / 60
    const bassLine = [38, 35, 43, 45] as const
    const chords = [[57, 62, 66], [54, 59, 62], [55, 59, 62, 66], [57, 61, 64]] as const
    for (let bar = 0; bar < 4; bar++) {
      bass(rig, l.gain, t + bar * 3 * beat, bassLine[bar]!, 0.55, 3.5)
      pad(rig, l.gain, t + bar * 3 * beat, chords[bar]!, 0.55, 0.8, 1.6, 1.5, 1300, 0.6)
    }
    let at = t
    const up = l.phrase % 2 === 1 ? 12 : 0
    for (const [m, b] of PLUIE) {
      piano(rig, l.gain, at, m + up, 0.55, 3, 0.5)
      if (up) bell(rig, l.gain, at, m + up + 12, 0.25, 2)
      at += b * beat * 1.0
    }
    l.phrase++
    return Math.max(at - t, 12 * beat) + 4
  }

  const composers: Record<Cue, ((l: Lane, t: number) => number) | null> = {
    explore, home: drift, scellee: shallow, danger, night, wonder, rain, sortie, vista, dome: null, silence: null,
  }

  function sondeStinger(dest: AudioNode, t: number): void {
    const arp = [62, 69, 74, 76, 78, 81]
    arp.forEach((m, i) => {
      piano(rig, dest, t + i * 0.13, m, 0.55, 4, 0.5)
      bell(rig, dest, t + i * 0.13 + 0.02, m + 12, 0.25, 2.5)
    })
    pad(rig, dest, t + 0.6, [50, 57, 64, 66, 73], 0.9, 3.5, 8, 6, 1500, 0.7)
    choir(rig, dest, t + 2, [62, 69, 74], 0.4, 4, 6, 5)
    const melody = [81, 78, 76, 74, 76, 69]
    melody.forEach((m, i) => piano(rig, dest, t + 4 + i * 1.6, m, 0.35, 4, 0.6))
  }

  function jingle(dest: AudioNode, t: number, kind: 'trouvaille' | 'decouverte' | 'reveil'): void {
    if (kind === 'trouvaille') {
      ;[69, 74, 78, 81].forEach((m, i) => piano(rig, dest, t + i * 0.1, m, 0.5, i === 3 ? 3 : 1.2, 0.4))
      bell(rig, dest, t + 0.32, 86, 0.45, 3)
      bell(rig, dest, t + 0.45, 93, 0.25, 2.5)
    } else if (kind === 'decouverte') {
      ;[74, 81, 78, 83, 86].forEach((m, i) => piano(rig, dest, t + i * 0.22, m, 0.55, 4, 0.5))
      pad(rig, dest, t, [50, 57, 62, 66], 0.8, 0.6, 2.5, 3, 1400)
      bell(rig, dest, t + 0.9, 98, 0.3, 3)
    } else {
      ;[66, 69, 74].forEach((m, i) => piano(rig, dest, t + i * 0.35, m, 0.35, 3, 0.5))
    }
  }

  function stingerBus(): GainNode {
    const g = c.createGain()
    g.gain.value = 1
    g.connect(rig.music)
    window.setTimeout(() => g.disconnect(), 30000)
    return g
  }

  return {
    get cue() {
      return cue
    },
    setCue(next) {
      if (next === cue) return
      cue = next
      if (lane) closeLane(lane, next === 'dome' || next === 'wonder' ? 1 : 3)
      lane = null
      if (next === 'dome') {
        sondeStinger(stingerBus(), c.currentTime + 0.05)
        return
      }
      if (next === 'silence') return
      lane = openLane(next)
      applyMuffle(lane)
    },
    setMuffled(m) {
      if (m === muffled) return
      muffled = m
      if (lane) applyMuffle(lane)
    },
    setFlavor(f) {
      flavor = f
    },
    setEnergy(e) {
      energy = Math.max(0, Math.min(1, e))
    },
    stinger(kind) {
      const t = c.currentTime + 0.03
      if (kind === 'dome') sondeStinger(stingerBus(), t)
      else if (kind === 'scellee') jingle(stingerBus(), t, 'decouverte')
      else jingle(stingerBus(), t, kind)
      if (lane) {
        lane.gain.gain.setTargetAtTime(0.25, t, 0.1)
        lane.gain.gain.setTargetAtTime(1, t + 3, 1.5)
        lane.nextAt = Math.max(lane.nextAt, t + 4)
      }
    },
    update() {
      if (!lane) return
      const compose = composers[lane.cue]
      if (!compose) return
      while (lane.nextAt < c.currentTime + 0.3) {
        const t = Math.max(lane.nextAt, c.currentTime + 0.05)
        lane.nextAt = t + compose(lane, t)
      }
    },
  }
}
