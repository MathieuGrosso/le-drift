export const SILENT = 0.0001

// Destinations that must stay dry: their reverb would skip the through-glass muffling.
export const DRY = new WeakSet<AudioNode>()

export interface Rig {
  ctx: AudioContext
  master: GainNode
  music: GainNode
  amb: GainNode
  sfx: GainNode
  sfxFilter: BiquadFilterNode
  reverb: GainNode
  /** Sounds from the sea heard from inside: dull, quiet, louder and brighter near glass. */
  glass: GainNode
  glassTone: BiquadFilterNode
  roomSend: GainNode
  hallSend: GainNode
  white: AudioBuffer
  brown: AudioBuffer
  pink: AudioBuffer
}

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'brown' | 'pink'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      } else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046
        b1 = 0.963 * b1 + w * 0.2965164
        b2 = 0.57 * b2 + w * 1.0526913
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16
      } else {
        d[i] = w
      }
    }
  }
  return buf
}

function impulse(ctx: AudioContext, seconds: number, decay: number, early: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const k = i / len
      const a = 0.15 + 0.8 * k
      lp = lp * a + (Math.random() * 2 - 1) * (1 - a)
      d[i] = lp * Math.pow(1 - k, decay) * (1.6 + k)
    }
    for (let r = 0; r < early; r++) {
      const at = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.07))
      if (at < len) d[at] = (d[at] ?? 0) + (Math.random() < 0.5 ? -1 : 1) * (0.5 - r * 0.04)
    }
  }
  return buf
}

export function createRig(ctx: AudioContext): Rig {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.01
  comp.release.value = 0.3
  comp.connect(ctx.destination)

  const master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(comp)

  const music = ctx.createGain()
  music.gain.value = 0.62
  music.connect(master)

  const amb = ctx.createGain()
  amb.gain.value = 0.85
  amb.connect(master)

  const sfxFilter = ctx.createBiquadFilter()
  sfxFilter.type = 'lowpass'
  sfxFilter.frequency.value = 20000
  sfxFilter.Q.value = 0.5
  sfxFilter.connect(master)
  const sfx = ctx.createGain()
  sfx.gain.value = 0.9
  sfx.connect(sfxFilter)

  const room = ctx.createConvolver()
  room.buffer = impulse(ctx, 1.1, 3.2, 10)
  const hall = ctx.createConvolver()
  hall.buffer = impulse(ctx, 5, 2.4, 4)
  const reverbOut = ctx.createGain()
  reverbOut.gain.value = 0.55
  room.connect(reverbOut)
  hall.connect(reverbOut)
  reverbOut.connect(master)
  const roomSend = ctx.createGain()
  roomSend.gain.value = 0.6
  roomSend.connect(room)
  const hallSend = ctx.createGain()
  hallSend.gain.value = 0.6
  hallSend.connect(hall)
  const reverb = ctx.createGain()
  reverb.gain.value = 1
  reverb.connect(roomSend)
  reverb.connect(hallSend)

  const glassTone = ctx.createBiquadFilter()
  glassTone.type = 'lowpass'
  glassTone.frequency.value = 900
  glassTone.Q.value = 0.9
  const glassBody = ctx.createBiquadFilter()
  glassBody.type = 'peaking'
  glassBody.frequency.value = 180
  glassBody.gain.value = 5
  glassBody.Q.value = 0.8
  const glass = ctx.createGain()
  glass.gain.value = 0.5
  glass.connect(glassTone)
  glassTone.connect(glassBody)
  glassBody.connect(master)
  const glassVerb = ctx.createGain()
  glassVerb.gain.value = 0.25
  glassBody.connect(glassVerb)
  glassVerb.connect(hall)

  return {
    ctx, master, music, amb, sfx, sfxFilter, reverb, glass, glassTone, roomSend, hallSend,
    white: noiseBuffer(ctx, 3, 'white'),
    brown: noiseBuffer(ctx, 6, 'brown'),
    pink: noiseBuffer(ctx, 4, 'pink'),
  }
}

export function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

export function noise(rig: Rig, kind: 'white' | 'brown' | 'pink', t: number, dur: number, loop = false): AudioBufferSourceNode {
  const s = rig.ctx.createBufferSource()
  s.buffer = kind === 'white' ? rig.white : kind === 'brown' ? rig.brown : rig.pink
  s.loop = loop
  const buf = s.buffer
  const off = loop ? Math.random() * buf.duration : Math.random() * Math.max(0, buf.duration - dur - 0.05)
  s.start(t, off)
  if (!loop) s.stop(t + dur + 0.05)
  return s
}

export function filter(rig: Rig, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = rig.ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

/** Percussive envelope: fast attack to `peak`, exponential fall to silence at t + dur. */
export function perc(rig: Rig, t: number, peak: number, dur: number, attack = 0.005): GainNode {
  const g = rig.ctx.createGain()
  g.gain.setValueAtTime(SILENT, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack)
  g.gain.exponentialRampToValueAtTime(SILENT, t + Math.max(dur, attack + 0.01))
  return g
}

/** Connects `node` to `dest` and sends `send` of it to the reverb. */
export function out(rig: Rig, node: AudioNode, dest: AudioNode, send: number): void {
  node.connect(dest)
  if (send > 0 && dest !== rig.glass && !DRY.has(dest)) {
    const s = rig.ctx.createGain()
    s.gain.value = send
    node.connect(s)
    s.connect(rig.reverb)
  }
}

export function osc(rig: Rig, type: OscillatorType, freq: number, t: number, dur: number): OscillatorNode {
  const o = rig.ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.start(t)
  o.stop(t + dur + 0.05)
  return o
}
