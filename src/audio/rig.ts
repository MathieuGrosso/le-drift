export const SILENT = 0.0001

export interface Rig {
  ctx: AudioContext
  master: GainNode
  music: GainNode
  amb: GainNode
  sfx: GainNode
  sfxFilter: BiquadFilterNode
  reverb: GainNode
  white: AudioBuffer
  brown: AudioBuffer
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (brown) {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      } else {
        d[i] = w
      }
    }
  }
  return buf
}

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
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
  music.gain.value = 0.7
  music.connect(master)

  const amb = ctx.createGain()
  amb.gain.value = 0.8
  amb.connect(master)

  const sfxFilter = ctx.createBiquadFilter()
  sfxFilter.type = 'lowpass'
  sfxFilter.frequency.value = 20000
  sfxFilter.Q.value = 0.5
  sfxFilter.connect(master)
  const sfx = ctx.createGain()
  sfx.gain.value = 0.9
  sfx.connect(sfxFilter)

  const conv = ctx.createConvolver()
  conv.buffer = impulse(ctx, 4.5, 2.6)
  const reverbOut = ctx.createGain()
  reverbOut.gain.value = 0.55
  conv.connect(reverbOut)
  reverbOut.connect(master)
  const reverb = ctx.createGain()
  reverb.gain.value = 1
  reverb.connect(conv)

  return {
    ctx, master, music, amb, sfx, sfxFilter, reverb,
    white: noiseBuffer(ctx, 3, false),
    brown: noiseBuffer(ctx, 6, true),
  }
}

export function mtof(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

export function noise(rig: Rig, kind: 'white' | 'brown', t: number, dur: number, loop = false): AudioBufferSourceNode {
  const s = rig.ctx.createBufferSource()
  s.buffer = kind === 'white' ? rig.white : rig.brown
  s.loop = loop
  const buf = s.buffer
  const off = loop ? 0 : Math.random() * Math.max(0, buf.duration - dur - 0.05)
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
  if (send > 0) {
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
