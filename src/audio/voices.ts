import { filter, mtof, noise, osc, out, perc, SILENT, type Rig } from './rig'

export function piano(rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, dur = 3.5, send = 0.4): void {
  const c = rig.ctx
  const f = mtof(midi)
  const amp = c.createGain()
  const peak = 0.28 * vel
  amp.gain.setValueAtTime(SILENT, t)
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.006)
  amp.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35)
  amp.gain.exponentialRampToValueAtTime(SILENT, t + dur)

  const car = osc(rig, 'sine', f, t, dur)
  const mod = osc(rig, 'sine', f, t, dur)
  const idx = c.createGain()
  idx.gain.setValueAtTime(f * (0.6 + 1.6 * vel), t)
  idx.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.9)
  mod.connect(idx)
  idx.connect(car.frequency)

  const over = osc(rig, 'sine', f * 2.002, t, dur * 0.5)
  const overG = perc(rig, t, 0.25, dur * 0.5)
  over.connect(overG)
  overG.connect(amp)

  const tone = filter(rig, 'lowpass', Math.min(9000, 900 + f * 5), 0.4)
  car.connect(tone)
  tone.connect(amp)
  out(rig, amp, dest, send)
}

export function bell(
  rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, dur = 2.6, ratio = 3.5, send = 0.5,
): void {
  const c = rig.ctx
  const f = mtof(midi)
  const amp = perc(rig, t, 0.16 * vel, dur, 0.003)
  const car = osc(rig, 'sine', f, t, dur)
  const mod = osc(rig, 'sine', f * ratio, t, dur)
  const idx = c.createGain()
  idx.gain.setValueAtTime(f * 1.8 * vel, t)
  idx.gain.exponentialRampToValueAtTime(f * 0.01, t + dur * 0.5)
  mod.connect(idx)
  idx.connect(car.frequency)
  car.connect(amp)
  const p2 = osc(rig, 'sine', f * 2.76, t, dur * 0.4)
  const p2g = perc(rig, t, 0.05 * vel, dur * 0.4, 0.002)
  p2.connect(p2g)
  p2g.connect(dest)
  out(rig, amp, dest, send)
}

export function pluck(rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, dur = 0.8, send = 0.25): void {
  const f = mtof(midi)
  const amp = perc(rig, t, 0.22 * vel, dur, 0.003)
  osc(rig, 'sine', f, t, dur).connect(amp)
  const hi = osc(rig, 'sine', f * 4, t, 0.15)
  const hig = perc(rig, t, 0.05 * vel, 0.15, 0.002)
  hi.connect(hig)
  hig.connect(amp)
  out(rig, amp, dest, send)
}

export function bass(rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, dur = 3): void {
  const f = mtof(midi)
  const amp = rig.ctx.createGain()
  amp.gain.setValueAtTime(SILENT, t)
  amp.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.04)
  amp.gain.exponentialRampToValueAtTime(SILENT, t + dur)
  osc(rig, 'sine', f, t, dur).connect(amp)
  const tri = osc(rig, 'triangle', f * 2, t, dur)
  const tg = rig.ctx.createGain()
  tg.gain.value = 0.15
  tri.connect(tg)
  tg.connect(amp)
  out(rig, amp, dest, 0.15)
}

/** Slow saw pad. `attack`, `hold` and `release` in seconds. */
export function pad(
  rig: Rig, dest: AudioNode, t: number, notes: readonly number[], vel: number,
  attack: number, hold: number, release: number, bright = 900, send = 0.5,
): void {
  const c = rig.ctx
  const dur = attack + hold + release
  const amp = c.createGain()
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime((0.11 * vel) / Math.sqrt(notes.length), t + attack)
  amp.gain.setValueAtTime((0.11 * vel) / Math.sqrt(notes.length), t + attack + hold)
  amp.gain.linearRampToValueAtTime(0, t + dur)
  const lp = filter(rig, 'lowpass', bright, 0.7)
  const lfo = osc(rig, 'sine', 0.09 + Math.random() * 0.05, t, dur)
  const lfoG = c.createGain()
  lfoG.gain.value = bright * 0.35
  lfo.connect(lfoG)
  lfoG.connect(lp.frequency)
  for (const m of notes) {
    for (const det of [-7, 6]) {
      const o = osc(rig, 'sawtooth', mtof(m), t, dur)
      o.detune.value = det
      o.connect(lp)
    }
  }
  lp.connect(amp)
  out(rig, amp, dest, send)
}

export function choir(
  rig: Rig, dest: AudioNode, t: number, notes: readonly number[], vel: number, attack: number, hold: number, release: number,
): void {
  const c = rig.ctx
  const dur = attack + hold + release
  const amp = c.createGain()
  const lvl = (0.5 * vel) / Math.sqrt(notes.length)
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(lvl, t + attack)
  amp.gain.setValueAtTime(lvl, t + attack + hold)
  amp.gain.linearRampToValueAtTime(0, t + dur)
  const f1 = filter(rig, 'bandpass', 650, 7)
  const f2 = filter(rig, 'bandpass', 1080, 9)
  const f2g = c.createGain()
  f2g.gain.value = 0.6
  f2.connect(f2g)
  const vib = osc(rig, 'sine', 4.8, t, dur)
  const vibG = c.createGain()
  vibG.gain.value = 6
  vib.connect(vibG)
  for (const m of notes) {
    const o = osc(rig, 'sawtooth', mtof(m), t, dur)
    vibG.connect(o.detune)
    o.connect(f1)
    o.connect(f2)
  }
  f1.connect(amp)
  f2g.connect(amp)
  out(rig, amp, dest, 0.8)
}

export function clap(rig: Rig, dest: AudioNode, t: number, vel: number): void {
  const bp = filter(rig, 'bandpass', 1100 + Math.random() * 300, 1.2)
  const amp = rig.ctx.createGain()
  amp.gain.setValueAtTime(SILENT, t)
  for (let i = 0; i < 3; i++) {
    const ti = t + i * 0.011
    amp.gain.setValueAtTime(0.5 * vel, ti)
    amp.gain.exponentialRampToValueAtTime(0.05 * vel, ti + 0.009)
  }
  amp.gain.exponentialRampToValueAtTime(SILENT, t + 0.16)
  noise(rig, 'white', t, 0.18).connect(bp)
  bp.connect(amp)
  out(rig, amp, dest, 0.3)
}

export function tick(rig: Rig, dest: AudioNode, t: number, vel: number): void {
  const hp = filter(rig, 'highpass', 5000, 0.7)
  const amp = perc(rig, t, 0.12 * vel, 0.04, 0.001)
  noise(rig, 'white', t, 0.05).connect(hp)
  hp.connect(amp)
  out(rig, amp, dest, 0.1)
}

const VOWELS = {
  a: [800, 1150, 2900],
  e: [400, 1700, 2600],
  i: [300, 2200, 3000],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
  an: [600, 1000, 2500],
} as const
export type Vowel = keyof typeof VOWELS

/** A sung syllable through three formants. `child` raises the formants like a small vocal tract. */
export function sing(
  rig: Rig, dest: AudioNode, t: number, midi: number, vowel: Vowel, vel: number, dur: number,
  child = false, send = 0.4,
): void {
  const c = rig.ctx
  const f0 = mtof(midi)
  const scale = child ? 1.18 : 1
  const amp = c.createGain()
  amp.gain.setValueAtTime(SILENT, t)
  const peak = Math.max(SILENT * 2, 0.5 * vel)
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.03)
  amp.gain.setValueAtTime(peak, t + Math.max(0.04, dur - 0.08))
  amp.gain.exponentialRampToValueAtTime(SILENT, t + dur + 0.06)
  const src = osc(rig, 'sawtooth', f0 * 0.985, t, dur + 0.1)
  src.frequency.linearRampToValueAtTime(f0, t + 0.06)
  const vib = osc(rig, 'sine', 5.2 + Math.random(), t, dur + 0.1)
  const vg = c.createGain()
  vg.gain.setValueAtTime(0, t)
  vg.gain.linearRampToValueAtTime(child ? 10 : 14, t + dur * 0.6 + 0.05)
  vib.connect(vg)
  vg.connect(src.detune)
  const breath = noise(rig, 'white', t, dur + 0.1)
  const bg = c.createGain()
  bg.gain.value = 0.04
  breath.connect(bg)
  const mix = c.createGain()
  mix.gain.value = 1
  src.connect(mix)
  bg.connect(mix)
  VOWELS[vowel].forEach((fr, i) => {
    const bp = filter(rig, 'bandpass', fr * scale, 6 + i * 3)
    const g = c.createGain()
    g.gain.value = [1, 0.5, 0.18][i]!
    mix.connect(bp)
    bp.connect(g)
    g.connect(amp)
  })
  out(rig, amp, dest, send)
}

/** A short unintelligible spoken phrase: syllables with a falling contour. */
export function murmurPhrase(rig: Rig, dest: AudioNode, t: number, vel: number, pitch: number, child = false): number {
  const n = 2 + Math.floor(Math.random() * 5)
  const vowels: Vowel[] = ['a', 'e', 'o', 'i', 'u', 'an']
  let at = t
  for (let i = 0; i < n; i++) {
    const d = 0.08 + Math.random() * 0.12
    const m = pitch + (Math.random() * 3 - 1) - (i / n) * 3
    sing(rig, dest, at, m, vowels[Math.floor(Math.random() * vowels.length)]!, vel * (0.6 + Math.random() * 0.4), d, child, 0.3)
    at += d + 0.02 + Math.random() * 0.05
  }
  return at - t
}

export function marimba(rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, send = 0.35): void {
  const f = mtof(midi)
  const amp = perc(rig, t, 0.2 * vel, 1.1, 0.002)
  osc(rig, 'sine', f, t, 1.1).connect(amp)
  const o4 = osc(rig, 'sine', f * 3.98, t, 0.25)
  const g4 = perc(rig, t, 0.07 * vel, 0.25, 0.001)
  o4.connect(g4)
  g4.connect(amp)
  out(rig, amp, dest, send)
}

export function flute(rig: Rig, dest: AudioNode, t: number, midi: number, vel: number, dur: number, send = 0.55): void {
  const c = rig.ctx
  const f = mtof(midi)
  const amp = c.createGain()
  amp.gain.setValueAtTime(SILENT, t)
  const peak = Math.max(SILENT * 2, 0.1 * vel)
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.12)
  amp.gain.setValueAtTime(peak, t + Math.max(0.13, dur - 0.2))
  amp.gain.exponentialRampToValueAtTime(SILENT, t + dur + 0.3)
  const o = osc(rig, 'triangle', f, t, dur + 0.35)
  const vib = osc(rig, 'sine', 4.6, t, dur + 0.35)
  const vg = c.createGain()
  vg.gain.setValueAtTime(0, t)
  vg.gain.linearRampToValueAtTime(9, t + 0.6)
  vib.connect(vg)
  vg.connect(o.detune)
  const lp = filter(rig, 'lowpass', f * 3, 0.5)
  o.connect(lp)
  lp.connect(amp)
  const air = noise(rig, 'white', t, dur + 0.3)
  const ab = filter(rig, 'bandpass', f * 2, 4)
  const ag = c.createGain()
  ag.gain.value = 0.25
  air.connect(ab)
  ab.connect(ag)
  ag.connect(amp)
  out(rig, amp, dest, send)
}
