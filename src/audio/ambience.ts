import type { RoomId } from '../core/types'
import { filter, noise, osc, type Rig } from './rig'

export interface AmbienceInput {
  medium: 'water' | 'air'
  room: RoomId | null
  rain: number
  ventProximity: number
  depth01: number
}

export interface Ambience {
  update(dt: number, s: AmbienceInput): void
  dispose(): void
}

export interface AmbienceHooks {
  oneShot(id: string, amount: number, near: boolean): void
}

const BUSY_ROOMS: readonly RoomId[] = ['refectoire', 'cuisine', 'marche', 'rebord']

export function createAmbience(rig: Rig, hooks: AmbienceHooks, rnd: () => number): Ambience {
  const c = rig.ctx
  const t0 = c.currentTime
  const sources: AudioScheduledSourceNode[] = []
  const loop = (kind: 'white' | 'brown') => {
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

  const bedFilter = filter(rig, 'lowpass', 380, 0.8)
  const bed = c.createGain()
  bed.gain.value = 0
  loop('brown').connect(bedFilter)
  bedFilter.connect(bed)
  bed.connect(rig.amb)
  lfo(0.06, 120, bedFilter.frequency)

  const fizzFilter = filter(rig, 'bandpass', 4200, 0.8)
  const fizz = c.createGain()
  fizz.gain.value = 0
  loop('white').connect(fizzFilter)
  fizzFilter.connect(fizz)
  fizz.connect(rig.amb)

  const ventFilter = filter(rig, 'lowpass', 110, 1.2)
  const vent = c.createGain()
  vent.gain.value = 0
  loop('brown').connect(ventFilter)
  ventFilter.connect(vent)
  const ventHum = osc(rig, 'sine', 38, t0, 1e6)
  sources.push(ventHum)
  const humG = c.createGain()
  humG.gain.value = 0.35
  ventHum.connect(humG)
  humG.connect(vent)
  vent.connect(rig.amb)

  const rainHp = filter(rig, 'highpass', 900, 0.5)
  const rainLp = filter(rig, 'lowpass', 2600, 0.5)
  const rain = c.createGain()
  rain.gain.value = 0
  loop('white').connect(rainHp)
  rainHp.connect(rainLp)
  rainLp.connect(rain)
  rain.connect(rig.amb)
  lfo(0.3, 0.02, rain.gain)

  const murmurBp = filter(rig, 'bandpass', 520, 1.4)
  const murmurBp2 = filter(rig, 'bandpass', 1150, 2)
  const murmur = c.createGain()
  murmur.gain.value = 0
  const mSrc = loop('brown')
  mSrc.connect(murmurBp)
  mSrc.connect(murmurBp2)
  murmurBp.connect(murmur)
  murmurBp2.connect(murmur)
  murmur.connect(rig.amb)

  let creakIn = 6 + rnd() * 8
  let bubbleIn = 4 + rnd() * 6
  let clinkIn = 2
  let dropIn = 0
  let wobbleIn = 0
  let murmurLevel = 0

  const ease = (p: AudioParam, v: number, tc = 0.8) => p.setTargetAtTime(v, c.currentTime, tc)

  return {
    update(dt, s) {
      const water = s.medium === 'water'
      ease(bed.gain, water ? 0.55 : 0.32)
      ease(bedFilter.frequency, water ? 380 - 120 * s.depth01 : 140)
      ease(fizz.gain, water ? 0.018 : 0)
      ease(vent.gain, water ? 0.8 * s.ventProximity : 0.1 * s.ventProximity, 1.5)
      ease(rain.gain, water ? 0.16 * s.rain : 0.05 * s.rain, 1.5)
      const busy = !water && s.room !== null && BUSY_ROOMS.includes(s.room)
      murmurLevel = busy ? 0.1 : 0

      wobbleIn -= dt
      if (wobbleIn <= 0) {
        wobbleIn = 0.18 + rnd() * 0.3
        ease(murmur.gain, murmurLevel * (0.4 + rnd() * 0.8), 0.08)
        if (busy) ease(murmurBp.frequency, 420 + rnd() * 260, 0.1)
      }

      if (!water) {
        creakIn -= dt
        if (creakIn <= 0) {
          creakIn = 8 + rnd() * 12
          hooks.oneShot('creak', 0.4 + rnd() * 0.6, true)
        }
        if (busy) {
          clinkIn -= dt
          if (clinkIn <= 0) {
            clinkIn = 0.8 + rnd() * 3.5
            hooks.oneShot('clink', rnd(), true)
          }
        }
      } else {
        bubbleIn -= dt
        if (bubbleIn <= 0) {
          bubbleIn = 6 + rnd() * 10
          hooks.oneShot('bubbles', 0.2 + rnd() * 0.4, false)
        }
      }

      if (s.rain > 0.02) {
        dropIn -= dt
        if (dropIn <= 0) {
          dropIn = (0.05 + rnd() * 0.25) / Math.max(0.15, s.rain)
          hooks.oneShot(water ? 'rain-drop' : 'ring', 0.3 + rnd() * 0.5 * s.rain, false)
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
      for (const n of [bed, fizz, vent, rain, murmur]) n.disconnect()
    },
  }
}
