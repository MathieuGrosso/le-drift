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
