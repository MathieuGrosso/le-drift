import { INDOOR } from '../core/tuning'
import { filter, mtof, noise, osc, out, perc, SILENT, type Rig } from './rig'
import { bell, clap, murmurPhrase, piano, pluck, sing, type Vowel } from './voices'

export type SfxFn = (rig: Rig, dest: AudioNode, t: number, amount: number) => void

function bubble(rig: Rig, dest: AudioNode, t: number, f: number, vel: number): void {
  const len = 0.05 + Math.random() * 0.08
  const o = osc(rig, 'sine', f, t, len)
  o.frequency.exponentialRampToValueAtTime(f * (1.6 + Math.random() * 0.6), t + len)
  const g = perc(rig, t, 0.12 * vel, len, 0.003)
  o.connect(g)
  out(rig, g, dest, 0.25)
}

function bubbles(rig: Rig, dest: AudioNode, t: number, n: number, spread: number, lo: number, hi: number, vel = 1): void {
  for (let i = 0; i < n; i++) {
    bubble(rig, dest, t + Math.random() * spread, lo + Math.random() * (hi - lo), vel * (0.5 + Math.random() * 0.5))
  }
}

function noiseHit(
  rig: Rig, dest: AudioNode, t: number, type: BiquadFilterType, freq: number, q: number,
  peak: number, dur: number, send = 0.2, kind: 'white' | 'brown' | 'pink' = 'white',
): BiquadFilterNode {
  const f = filter(rig, type, freq, q)
  const g = perc(rig, t, peak, dur, 0.004)
  noise(rig, kind, t, dur).connect(f)
  f.connect(g)
  out(rig, g, dest, send)
  return f
}

function metal(rig: Rig, dest: AudioNode, t: number, base: number, vel: number, dur: number): void {
  for (const r of [1, 1.55, 2.67, 3.69, 5.4]) {
    const o = osc(rig, 'sine', base * r, t, dur)
    const g = perc(rig, t, (0.09 * vel) / r, dur / Math.sqrt(r), 0.002)
    o.connect(g)
    out(rig, g, dest, 0.35)
  }
  noiseHit(rig, dest, t, 'bandpass', 2500, 1, 0.3 * vel, 0.05)
}

function stickSlip(rig: Rig, dest: AudioNode, t: number, freq: number, dur: number, clicks: number, vel: number): void {
  const bp = filter(rig, 'bandpass', freq, 8)
  const amp = rig.ctx.createGain()
  amp.gain.setValueAtTime(0, t)
  let at = t
  for (let i = 0; i < clicks; i++) {
    const k = i / clicks
    at += (dur / clicks) * (1.4 - k * 0.8) * (0.7 + Math.random() * 0.6)
    amp.gain.setValueAtTime(0.9 * vel, at)
    amp.gain.setTargetAtTime(0, at + 0.002, 0.006)
  }
  noise(rig, 'white', t, dur + 0.2).connect(bp)
  bp.connect(amp)
  out(rig, amp, dest, 0.3)
}

function sweep(rig: Rig, dest: AudioNode, t: number, from: number, to: number, dur: number, peak: number): void {
  const f = filter(rig, 'bandpass', from, 1.5)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = rig.ctx.createGain()
  g.gain.setValueAtTime(SILENT, t)
  g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.4)
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
  noise(rig, 'white', t, dur).connect(f)
  f.connect(g)
  out(rig, g, dest, 0.25)
}

function cry(rig: Rig, dest: AudioNode, t: number, scale: number): void {
  const dur = 0.45
  const o = osc(rig, 'sawtooth', 1700 * scale, t, dur)
  o.frequency.linearRampToValueAtTime(2600 * scale, t + 0.08)
  o.frequency.exponentialRampToValueAtTime(1400 * scale, t + dur)
  const vib = osc(rig, 'sine', 32, t, dur)
  const vg = rig.ctx.createGain()
  vg.gain.value = 40
  vib.connect(vg)
  vg.connect(o.frequency)
  const bp = filter(rig, 'bandpass', 2100 * scale, 2.5)
  const g = rig.ctx.createGain()
  g.gain.setValueAtTime(SILENT, t)
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.05)
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
  o.connect(bp)
  bp.connect(g)
  out(rig, g, dest, 0.7)
}

export type StepSurface = 'sable' | 'bois' | 'metal' | 'tapis' | 'grille' | 'echelle' | 'mouille'

function step(rig: Rig, dest: AudioNode, t: number, surface: StepSurface, wet: boolean, v: number): void {
  if (surface === 'sable') {
    noiseHit(rig, dest, t, 'lowpass', 700, 0.7, 0.35 * v, 0.14, 0.1)
  } else if (surface === 'bois') {
    const f0 = 105 + Math.random() * 35
    const o = osc(rig, 'sine', f0, t, 0.13)
    o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.1)
    const g = perc(rig, t, 0.3 * v, 0.13, 0.002)
    o.connect(g)
    out(rig, g, dest, 0.15)
    noiseHit(rig, dest, t, 'bandpass', 800 + Math.random() * 300, 1.5, 0.14 * v, 0.05)
    if (Math.random() < 0.12) stickSlip(rig, dest, t + 0.04, 380 + Math.random() * 200, 0.25, 6, 0.18 * v)
  } else if (surface === 'metal') {
    metal(rig, dest, t, 340 + Math.random() * 80, 1.1 * v, 0.3)
    noiseHit(rig, dest, t, 'lowpass', 400, 0.7, 0.22 * v, 0.08)
  } else if (surface === 'grille') {
    metal(rig, dest, t, 520 + Math.random() * 120, 0.9 * v, 0.18)
    for (let i = 1; i < 3; i++) metal(rig, dest, t + i * (0.012 + Math.random() * 0.01), 900 + Math.random() * 400, 0.12 * v, 0.07)
    noiseHit(rig, dest, t, 'lowpass', 350, 0.7, 0.18 * v, 0.07)
  } else if (surface === 'echelle') {
    metal(rig, dest, t, 620 + Math.random() * 90, 0.7 * v, 0.4)
  } else if (surface === 'mouille') {
    noiseHit(rig, dest, t, 'bandpass', 1200, 1.2, 0.2 * v, 0.12, 0.1)
    bubbles(rig, dest, t + 0.01, 2, 0.05, 600, 1200, 0.4 * v)
  } else {
    noiseHit(rig, dest, t, 'lowpass', 500, 0.5, 0.15 * v, 0.1, 0.05)
  }
  if (wet) noiseHit(rig, dest, t + 0.02, 'bandpass', 1600, 3, 0.12 * v, 0.09, 0.05)
}

function drop(rig: Rig, dest: AudioNode, t: number, f: number, vel: number, send: number): void {
  const o = osc(rig, 'sine', f, t, 0.09)
  o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.06)
  const g = perc(rig, t, 0.09 * vel, 0.09, 0.001)
  o.connect(g)
  out(rig, g, dest, send)
}

function hiss(rig: Rig, dest: AudioNode, t: number, dur: number, peak: number, freq = 3500): void {
  const hp = filter(rig, 'highpass', freq, 0.7)
  const g = rig.ctx.createGain()
  g.gain.setValueAtTime(SILENT, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.05)
  g.gain.exponentialRampToValueAtTime(peak * 0.6, t + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
  noise(rig, 'white', t, dur).connect(hp)
  hp.connect(g)
  out(rig, g, dest, 0.4)
}

function thud(rig: Rig, dest: AudioNode, t: number, f: number, peak: number, dur: number, send = 0.3): void {
  const o = osc(rig, 'sine', f * 1.6, t, dur)
  o.frequency.exponentialRampToValueAtTime(f, t + dur * 0.4)
  const g = perc(rig, t, peak, dur, 0.003)
  o.connect(g)
  out(rig, g, dest, send)
}

export const SFX: Record<string, SfxFn> = {
  bubbles: (r, d, t, a) => bubbles(r, d, t, Math.round(6 + 8 * a), 0.7, 380, 1400),
  kick: (r, d, t, a) => {
    sweep(r, d, t, 280, 900, 0.35, 0.3 * a + 0.1)
    bubbles(r, d, t + 0.05, 4, 0.3, 500, 1200, 0.6)
  },
  scrub: (r, d, t, a) => {
    const dur = 0.16 + Math.random() * 0.12
    const f0 = 900 + Math.random() * 500
    const o = osc(r, 'triangle', f0, t, dur)
    o.frequency.linearRampToValueAtTime(f0 * (1.25 + Math.random() * 0.3), t + dur)
    const vib = osc(r, 'square', 17 + Math.random() * 8, t, dur)
    const vg = r.ctx.createGain()
    vg.gain.value = 60
    vib.connect(vg)
    vg.connect(o.frequency)
    const bp = filter(r, 'bandpass', f0 * 1.3, 5)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(SILENT, t)
    g.gain.exponentialRampToValueAtTime(0.16 * (0.5 + a * 0.5), t + 0.03)
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
    o.connect(bp)
    bp.connect(g)
    out(r, g, d, 0.1)
    noiseHit(r, d, t, 'bandpass', 2200, 1.2, 0.06, dur, 0.05)
  },
  'scrub-done': (r, d, t) => {
    ;[86, 90, 93].forEach((m, i) => bell(r, d, t + i * 0.07, m, 0.35, 1.8, 3.5))
  },
  chest: (r, d, t) => {
    ;[69, 74, 78, 81].forEach((m, i) => piano(r, d, t + i * 0.1, m, 0.5, i === 3 ? 3 : 1.2, 0.4))
    bell(r, d, t + 0.32, 86, 0.45, 3)
  },
  discovery: (r, d, t) => {
    ;[74, 81, 78, 83, 86].forEach((m, i) => piano(r, d, t + i * 0.22, m, 0.55, 4, 0.5))
    bell(r, d, t + 0.9, 98, 0.3, 3)
  },
  sonde: (r, d, t) => {
    const o = osc(r, 'sine', 55, t, 2.2)
    o.frequency.exponentialRampToValueAtTime(110, t + 1.6)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(SILENT, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.6)
    g.gain.exponentialRampToValueAtTime(SILENT, t + 2.2)
    o.connect(g)
    out(r, g, d, 0.3)
    sweep(r, d, t, 200, 3000, 1.6, 0.12)
    for (let i = 0; i < 4; i++) {
      const ti = t + 1.7 + i * 0.9
      const p = osc(r, 'sine', 1250, ti, 1.2)
      const pg = perc(r, ti, 0.2 * Math.pow(0.55, i), 1.2, 0.002)
      p.connect(pg)
      out(r, pg, d, 0.8)
    }
  },
  bird: (r, d, t) => {
    cry(r, d, t, 1)
    cry(r, d, t + 0.55, 0.92)
    if (Math.random() < 0.6) cry(r, d, t + 1.2, 1.05)
  },
  'rain-drop': (r, d, t, a) => {
    const f = 1500 + Math.random() * 900
    const o = osc(r, 'sine', f, t, 0.06)
    o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.05)
    const g = perc(r, t, 0.05 * a + 0.02, 0.06, 0.001)
    o.connect(g)
    out(r, g, d, 0.4)
  },
  ring: (r, d, t, a) => {
    const f = 700 + Math.random() * 300
    const o = osc(r, 'sine', f, t, 0.25)
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.12)
    const g = perc(r, t, 0.12 * Math.min(1, a + 0.3), 0.25, 0.004)
    o.connect(g)
    out(r, g, d, 0.9)
  },
  'lock-clang': (r, d, t) => {
    metal(r, d, t, 180, 1, 2.2)
    noiseHit(r, d, t, 'lowpass', 300, 0.7, 0.4, 0.3, 0.3, 'brown')
  },
  hatch: (r, d, t) => {
    stickSlip(r, d, t, 2200, INDOOR.hatchSpinSeconds, 14, 0.5)
    metal(r, d, t + INDOOR.hatchSpinSeconds, 260, 0.7, 1.2)
  },
  pump: (r, d, t) => {
    const dur = INDOOR.airlockSeconds
    const lp = filter(r, 'lowpass', 280, 1)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.4, t + 0.6)
    g.gain.setValueAtTime(0.4, t + dur - 1)
    g.gain.linearRampToValueAtTime(0, t + dur)
    const throb = osc(r, 'sine', 2.2, t, dur)
    const tg = r.ctx.createGain()
    tg.gain.value = 0.18
    throb.connect(tg)
    tg.connect(g.gain)
    noise(r, 'brown', t, dur).connect(lp)
    lp.connect(g)
    const hum = osc(r, 'triangle', 58, t, dur)
    const hg = r.ctx.createGain()
    hg.gain.value = 0.15
    hum.connect(hg)
    hg.connect(g)
    out(r, g, d, 0.2)
    bubbles(r, d, t + 0.5, 30, dur - 1.5, 200, 700, 0.8)
  },
  rope: (r, d, t) => stickSlip(r, d, t, 650, 0.7, 18, 0.6),
  creak: (r, d, t, a) => stickSlip(r, d, t, 260 + Math.random() * 200, 0.9 + Math.random() * 0.8, 26, 0.25 + 0.2 * a),
  groan: (r, d, t, a) => {
    const dur = 3.2
    const o = osc(r, 'sawtooth', 48, t, dur)
    o.frequency.linearRampToValueAtTime(37, t + dur)
    const bp = filter(r, 'bandpass', 130, 3)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3 * (0.5 + a * 0.5), t + 1)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(bp)
    bp.connect(g)
    out(r, g, d, 0.6)
    stickSlip(r, d, t + 0.4, 180, 2.2, 30, 0.2)
  },
  fish: (r, d, t) => {
    const bp = filter(r, 'bandpass', 1500, 1.5)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    const am = osc(r, 'square', 26, t, 0.35)
    const ag = r.ctx.createGain()
    ag.gain.value = 0.06
    am.connect(ag)
    ag.connect(g.gain)
    g.gain.setTargetAtTime(0, t + 0.25, 0.04)
    noise(r, 'white', t, 0.35).connect(bp)
    bp.connect(g)
    out(r, g, d, 0.2)
  },
  whale: (r, d, t, a) => {
    const dur = 4 + Math.random() * 3
    const f0 = 170 + Math.random() * 60
    const o = osc(r, 'sine', f0, t, dur)
    o.frequency.exponentialRampToValueAtTime(f0 * 2.3, t + dur * 0.35)
    o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + dur * 0.6)
    o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur)
    const h = osc(r, 'triangle', f0 * 2, t, dur)
    const hg = r.ctx.createGain()
    hg.gain.value = 0.12
    h.connect(hg)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.28 * (0.4 + a * 0.6), t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    const lp = filter(r, 'lowpass', 1200, 2)
    o.connect(lp)
    hg.connect(lp)
    lp.connect(g)
    out(r, g, d, 1)
  },
  'step-sable': (r, d, t, a) => step(r, d, t, 'sable', false, a),
  'step-bois': (r, d, t, a) => step(r, d, t, 'bois', false, a),
  'step-metal': (r, d, t, a) => step(r, d, t, 'metal', false, a),
  'step-tapis': (r, d, t, a) => step(r, d, t, 'tapis', false, a),
  'step-grille': (r, d, t, a) => step(r, d, t, 'grille', false, a),
  land: (r, d, t, a) => {
    const o = osc(r, 'sine', 80, t, 0.3)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25)
    const g = perc(r, t, 0.35 * a, 0.3, 0.003)
    o.connect(g)
    out(r, g, d, 0.2)
    noiseHit(r, d, t, 'lowpass', 900, 0.7, 0.3 * a, 0.6, 0.3)
  },
  sting: (r, d, t) => {
    const o = osc(r, 'sawtooth', 1800, t, 0.3)
    const m = osc(r, 'square', 73, t, 0.3)
    const mg = r.ctx.createGain()
    mg.gain.value = 900
    m.connect(mg)
    mg.connect(o.frequency)
    const g = perc(r, t, 0.08, 0.3, 0.002)
    const hp = filter(r, 'highpass', 900, 0.7)
    o.connect(hp)
    hp.connect(g)
    out(r, g, d, 0.2)
    noiseHit(r, d, t, 'highpass', 4000, 0.7, 0.1, 0.25)
  },
  'breath-empty': (r, d, t) => {
    bubbles(r, d, t, 10, 0.5, 200, 500, 1)
    const o = osc(r, 'sine', mtof(57), t, 1.2)
    o.frequency.exponentialRampToValueAtTime(mtof(50), t + 1)
    const g = perc(r, t, 0.12, 1.2, 0.05)
    o.connect(g)
    out(r, g, d, 0.4)
  },
  'breath-full': (r, d, t) => {
    ;[74, 78, 81].forEach((m, i) => bell(r, d, t + i * 0.08, m, 0.3, 1.6, 2))
  },
  pickup: (r, d, t) => {
    pluck(r, d, t, 81, 0.5)
    pluck(r, d, t + 0.09, 86, 0.5)
  },
  cook: (r, d, t) => {
    bubbles(r, d, t, 24, 1.2, 150, 450, 0.9)
    ;[74, 78, 81, 86].forEach((m, i) => pluck(r, d, t + 1.2 + i * 0.12, m, 0.5, 1.2))
  },
  'menu-open': (r, d, t) => pluck(r, d, t, 74, 0.35, 0.5),
  'menu-close': (r, d, t) => pluck(r, d, t, 69, 0.3, 0.5),
  paper: (r, d, t) => {
    for (let i = 0; i < 5; i++) noiseHit(r, d, t + i * 0.05 + Math.random() * 0.03, 'bandpass', 3200, 0.8, 0.08, 0.06, 0.05)
  },
  splash: (r, d, t, a) => {
    noiseHit(r, d, t, 'lowpass', 1800, 0.7, 0.35 * a + 0.1, 0.8, 0.5, 'brown')
    bubbles(r, d, t + 0.05, 18, 1, 250, 1100)
  },
  wings: (r, d, t) => {
    for (let i = 0; i < 4; i++) sweep(r, d, t + i * 0.32, 300, 1100, 0.3, 0.12)
  },
  voile: (r, d, t) => {
    for (let i = 0; i < 3; i++) noiseHit(r, d, t + i * 0.06, 'bandpass', 900 + i * 300, 1.2, 0.12, 0.08, 0.1)
    sweep(r, d, t + 0.1, 400, 1400, 0.5, 0.08)
  },
  clink: (r, d, t, a) => bell(r, d, t, 98 + Math.floor(Math.random() * 6), 0.15 + 0.15 * a, 0.6, 5.3, 0.2),
  door: (r, d, t) => stickSlip(r, d, t, 420, 0.6, 12, 0.6),
  sas: (r, d, t) => {
    noiseHit(r, d, t, 'lowpass', 600, 0.7, 0.4, 1.4, 0.4, 'brown')
    bubbles(r, d, t, 20, 1.2, 200, 900)
  },
  drip: (r, d, t, a) => drop(r, d, t, 900 + Math.random() * 1400, 0.4 + 0.6 * a, 0.7),
  'drip-echo': (r, d, t, a) => {
    const f = 700 + Math.random() * 900
    drop(r, d, t, f, 0.5 + 0.5 * a, 1)
    drop(r, d, t + 0.32, f, 0.15 * a, 1)
  },
  steam: (r, d, t, a) => hiss(r, d, t, 0.6 + Math.random() * 1.4, 0.07 + 0.08 * a, 2200 + Math.random() * 2000),
  piston: (r, d, t, a) => {
    thud(r, d, t, 42, 0.5 * a, 0.35, 0.2)
    metal(r, d, t + 0.18, 140 + Math.random() * 10, 0.25 * a, 0.25)
    if (Math.random() < 0.3) hiss(r, d, t + 0.2, 0.3, 0.03 * a, 5000)
  },
  hammer: (r, d, t, a) => {
    const n = 2 + Math.floor(Math.random() * 4)
    const base = 900 + Math.random() * 500
    for (let i = 0; i < n; i++) metal(r, d, t + i * (0.34 + Math.random() * 0.06), base, (0.35 + 0.2 * a) * (i === n - 1 ? 1.2 : 1), 0.5)
  },
  saw: (r, d, t, a) => {
    for (let i = 0; i < 4; i++) noiseHit(r, d, t + i * 0.28, 'bandpass', i % 2 ? 2400 : 1700, 3, 0.07 * a, 0.24, 0.1)
  },
  clock: (r, d, t, a) => {
    noiseHit(r, d, t, 'bandpass', 3800, 6, 0.2 * a, 0.03, 0.2)
    noiseHit(r, d, t + 0.5, 'bandpass', 3100, 6, 0.17 * a, 0.03, 0.2)
  },
  'clock-bell': (r, d, t, a) => {
    for (let i = 0; i < 3; i++) bell(r, d, t + i * 1.2, [74, 71, 66][i]!, 0.5 * a, 4, 2.76, 0.8)
  },
  snore: (r, d, t, a) => {
    const lp = filter(r, 'lowpass', 220, 4)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.18 * a, t + 0.9)
    g.gain.linearRampToValueAtTime(0, t + 1.6)
    const flutter = osc(r, 'square', 24 + Math.random() * 8, t, 1.7)
    const fg = r.ctx.createGain()
    fg.gain.value = 0.08 * a
    flutter.connect(fg)
    fg.connect(g.gain)
    noise(r, 'brown', t, 1.7).connect(lp)
    lp.connect(g)
    out(r, g, d, 0.15)
  },
  sizzle: (r, d, t, a) => {
    hiss(r, d, t, 1.2, 0.05 * a, 4500)
    for (let i = 0; i < 14; i++) noiseHit(r, d, t + Math.random() * 1.2, 'highpass', 6000, 0.7, 0.05 * a, 0.01, 0.05)
  },
  chop: (r, d, t, a) => {
    const n = 3 + Math.floor(Math.random() * 6)
    for (let i = 0; i < n; i++) {
      const ti = t + i * (0.16 + Math.random() * 0.04)
      thud(r, d, ti, 180 + Math.random() * 40, 0.18 * a, 0.08, 0.1)
      noiseHit(r, d, ti, 'bandpass', 2000, 2, 0.05 * a, 0.03)
    }
  },
  pot: (r, d, t, a) => bubbles(r, d, t, Math.round(8 + 10 * a), 1.4, 120, 380, 0.7),
  coins: (r, d, t, a) => {
    for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) bell(r, d, t + i * 0.05 + Math.random() * 0.04, 100 + Math.floor(Math.random() * 7), 0.12 * a + 0.05, 0.4, 5.3, 0.1)
  },
  crockery: (r, d, t, a) => {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) bell(r, d, t + i * 0.09 + Math.random() * 0.05, 92 + Math.floor(Math.random() * 9), 0.1 + 0.12 * a, 0.5, 4.2, 0.2)
    thud(r, d, t, 300, 0.05 * a, 0.06, 0.1)
  },
  laugh: (r, d, t, a) => {
    const n = 3 + Math.floor(Math.random() * 4)
    const p = 55 + Math.floor(Math.random() * 14)
    for (let i = 0; i < n; i++) sing(r, d, t + i * 0.13, p - i * 0.6, i % 2 ? 'a' : 'an', 0.6 * a, 0.09, false, 0.3)
  },
  voices: (r, d, t, a) => {
    murmurPhrase(r, d, t, 0.45 * a, 52 + Math.random() * 16)
  },
  'kid-call': (r, d, t, a) => {
    murmurPhrase(r, d, t, 0.4 * a, 70 + Math.random() * 6, true)
  },
  'vendor-call': (r, d, t, a) => {
    const p = 55 + Math.floor(Math.random() * 6)
    const vs: Vowel[] = ['o', 'a', 'e', 'o']
    vs.forEach((v, i) => sing(r, d, t + i * 0.22, p + (i === 1 ? 4 : i === 3 ? -2 : 0), v, 0.3 * a, i === 3 ? 0.5 : 0.18, false, 0.5))
  },
  'kettle': (r, d, t, a) => {
    const o = osc(r, 'sine', 1900 + Math.random() * 200, t, 2.5)
    o.frequency.linearRampToValueAtTime(2300, t + 2)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.025 * a, t + 1.6)
    g.gain.linearRampToValueAtTime(0, t + 2.5)
    o.connect(g)
    out(r, g, d, 0.3)
    hiss(r, d, t, 2.5, 0.02 * a, 3000)
  },
  'pipe-knock': (r, d, t, a) => {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) metal(r, d, t + i * (0.09 + Math.random() * 0.15), 210 + Math.random() * 40, 0.3 * a, 0.9)
  },
  'hull-tick': (r, d, t, a) => metal(r, d, t, 700 + Math.random() * 500, 0.4 * a, 1.4),
  'ladder-grab': (r, d, t, a) => metal(r, d, t, 600 + Math.random() * 90, 0.8 * a, 0.5),
  grip: (r, d, t, a) => noiseHit(r, d, t, 'bandpass', 1400, 1.4, 0.3 * a, 0.06, 0.05),
  zip: (r, d, t, a) => {
    const dur = 2.6
    const o = osc(r, 'sawtooth', 160, t, dur)
    o.frequency.exponentialRampToValueAtTime(420, t + dur * 0.7)
    const bp = filter(r, 'bandpass', 900, 2)
    bp.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.7)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(SILENT, t)
    g.gain.exponentialRampToValueAtTime(0.09 * a + 0.03, t + 0.3)
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur)
    o.connect(bp)
    bp.connect(g)
    out(r, g, d, 0.3)
    metal(r, d, t, 900, 0.3, 0.4)
    sweep(r, d, t, 300, 2000, dur, 0.06)
  },
  'zip-end': (r, d, t) => {
    metal(r, d, t, 300, 0.6, 0.8)
    thud(r, d, t, 70, 0.3, 0.3)
  },
  tube: (r, d, t, a) => {
    hiss(r, d, t, 0.25, 0.12 * a + 0.04, 1500)
    sweep(r, d, t + 0.15, 200, 3000, 1.2, 0.16)
    thud(r, d, t + 1.4, 90, 0.3, 0.3)
    hiss(r, d, t + 1.45, 0.6, 0.05, 2500)
  },
  slide: (r, d, t, a) => {
    const lp = filter(r, 'bandpass', 700, 0.8)
    lp.frequency.linearRampToValueAtTime(1300, t + 1.5)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(SILENT, t)
    g.gain.exponentialRampToValueAtTime(0.12 * a + 0.04, t + 0.2)
    g.gain.exponentialRampToValueAtTime(SILENT, t + 1.8)
    noise(r, 'pink', t, 1.8).connect(lp)
    lp.connect(g)
    out(r, g, d, 0.25)
  },
  valve: (r, d, t, a) => {
    stickSlip(r, d, t, 1500, 0.9, 10, 0.45 * a + 0.1)
    hiss(r, d, t + 0.6, 1.2, 0.06 * a + 0.02, 1800)
    bubbles(r, d, t + 0.7, 12, 1, 150, 500, 0.6)
  },
  lever: (r, d, t, a) => {
    stickSlip(r, d, t, 700, 0.25, 4, 0.4 * a)
    metal(r, d, t + 0.25, 170, 0.6 * a + 0.2, 1.4)
    thud(r, d, t + 0.25, 60, 0.3 * a, 0.4)
  },
  ballast: (r, d, t, a) => {
    const dur = 4
    const lp = filter(r, 'lowpass', 300, 1)
    lp.frequency.linearRampToValueAtTime(700, t + dur)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3 * a + 0.1, t + 0.8)
    g.gain.linearRampToValueAtTime(0, t + dur)
    noise(r, 'brown', t, dur).connect(lp)
    lp.connect(g)
    out(r, g, d, 0.5)
    bubbles(r, d, t + 0.3, 30, dur - 0.5, 90, 300, 0.9)
  },
  'water-rush': (r, d, t, a) => {
    const dur = 3
    const bp = filter(r, 'bandpass', 500, 0.6)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.35 * a + 0.1, t + 0.3)
    g.gain.linearRampToValueAtTime(0, t + dur)
    noise(r, 'pink', t, dur).connect(bp)
    bp.connect(g)
    out(r, g, d, 0.5)
    bubbles(r, d, t, 40, dur, 150, 900, 0.8)
  },
  'tether-clip': (r, d, t) => {
    metal(r, d, t, 2200, 0.35, 0.15)
    metal(r, d, t + 0.07, 2600, 0.3, 0.2)
  },
  'rope-taut': (r, d, t, a) => {
    stickSlip(r, d, t, 420, 0.5, 10, 0.5 * a + 0.2)
    thud(r, d, t, 55, 0.2 * a, 0.4)
  },
  'glass-tap': (r, d, t, a) => {
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const ti = t + i * (0.16 + Math.random() * 0.05)
      thud(r, d, ti, 420, 0.25 * a, 0.12, 0.1)
      bell(r, d, ti, 88 + Math.floor(Math.random() * 3), 0.08 * a, 0.25, 3.1, 0.1)
    }
  },
  breathe: (r, d, t, a) => {
    const bp = filter(r, 'bandpass', 1200, 0.8)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05 * a, t + 0.7)
    g.gain.linearRampToValueAtTime(0, t + 1.3)
    noise(r, 'pink', t, 1.3).connect(bp)
    bp.connect(g)
    out(r, g, d, 0.05)
    bubbles(r, d, t + 1.5, 9, 0.8, 250, 700, 0.5 * a)
  },
  dome: (r, d, t) => {
    for (let i = 0; i < 6; i++) metal(r, d, t + i * 0.18, 300 + i * 40, 0.25, 0.5)
    const o = osc(r, 'sine', 55, t + 1, 4)
    o.frequency.exponentialRampToValueAtTime(110, t + 3)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(SILENT, t + 1)
    g.gain.exponentialRampToValueAtTime(0.3, t + 2)
    g.gain.exponentialRampToValueAtTime(SILENT, t + 5)
    o.connect(g)
    out(r, g, d, 0.6)
    ;[62, 69, 74, 78].forEach((m, i) => bell(r, d, t + 2 + i * 0.15, m, 0.4, 5, 2.76, 0.9))
  },
  gong: (r, d, t, a) => metal(r, d, t, 98, 0.9 * a + 0.1, 6),
  bed: (r, d, t) => {
    noiseHit(r, d, t, 'lowpass', 900, 0.6, 0.15, 0.6, 0.05, 'pink')
    stickSlip(r, d, t + 0.2, 330, 0.5, 8, 0.2)
  },
  sit: (r, d, t) => {
    thud(r, d, t, 120, 0.2, 0.15, 0.1)
    stickSlip(r, d, t + 0.05, 420, 0.3, 6, 0.2)
  },
  stylo: (r, d, t) => {
    for (let i = 0; i < 6; i++) noiseHit(r, d, t + i * 0.09 + Math.random() * 0.04, 'bandpass', 5200 + Math.random() * 1500, 4, 0.05, 0.05 + Math.random() * 0.06, 0.05)
  },
  'chose-pass': (r, d, t) => {
    const dur = 5
    const o = osc(r, 'sine', 90, t, dur)
    o.frequency.linearRampToValueAtTime(70, t + dur)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.3, t + 2)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(g)
    out(r, g, d, 0.8)
    for (let i = 0; i < 6; i++) sweep(r, d, t + i * 0.7, 200, 800, 0.6, 0.05)
  },
  clap: (r, d, t, a) => {
    for (let i = 0; i < 3; i++) clap(r, d, t + i * 0.24 + Math.random() * 0.02, 0.5 * a + 0.2)
  },
  rain: (r, d, t, a) => {
    for (let i = 0; i < 6; i++) drop(r, d, t + Math.random() * 0.5, 1400 + Math.random() * 1500, 0.3 + a * 0.4, 0.5)
  },
}

const ALIASES: Record<string, string> = {
  'hatch-clang': 'lock-clang', 'hatch-wheel': 'hatch', 'hull-groan': 'groan',
  cueillette: 'pickup', echange: 'chest', essouffle: 'breath-empty', frotter: 'scrub',
  manger: 'cook', marmite: 'cook', miroir: 'ring', ouverture: 'discovery', sifflet: 'bird',
  'souffle-plus': 'breath-full', trouvaille: 'discovery', 'vitre-propre': 'scrub-done',
  'endurance-vide': 'breath-empty', 'endurance-pleine': 'breath-full',
  poulie: 'zip', toboggan: 'slide', vanne: 'valve', pompe: 'pump', levier: 'lever', lest: 'ballast',
  anneau: 'tether-clip', longe: 'rope-taut', vitre: 'glass-tap', lunette: 'paper', hamac: 'bed', lit: 'bed',
  'dome-veille': 'dome', cloche: 'gong',
}
for (const [alias, id] of Object.entries(ALIASES)) if (!SFX[alias] && SFX[id]) SFX[alias] = SFX[id]!

export function playSfx(rig: Rig, dest: AudioNode, id: string, t: number, amount = 1): boolean {
  const fn = SFX[id]
  if (!fn) return false
  fn(rig, dest, t, amount)
  return true
}

export function playStep(rig: Rig, dest: AudioNode, t: number, surface: StepSurface, wet: boolean, loud = 1): void {
  step(rig, dest, t, surface, wet, (0.7 + Math.random() * 0.3) * loud)
}
