import type { EnvState, Vec3 } from '../core/types'
import type { Gp, Weather } from './context'
import { UI } from './text/fr'

type From = 'sud' | 'ouest' | 'nord' | 'est'
const FLOW: Record<From, Vec3> = {
  sud: { x: 0, y: 0, z: -1 },
  nord: { x: 0, y: 0, z: 1 },
  ouest: { x: 1, y: 0, z: 0 },
  est: { x: -1, y: 0, z: 0 },
}
const FROM_ORDER: readonly From[] = ['sud', 'sud', 'ouest', 'est', 'nord']
const MAX_GITE = (4 * Math.PI) / 180

export function northMornings(flags: Record<string, boolean>): number {
  return Object.keys(flags).filter((k) => k.startsWith('nord-matin-') && flags[k]).length
}

export function createWeather(gp: Gp): Weather {
  const ctx = gp.ctx
  const gite = { roll: 0, pitch: 0 }
  const target = { roll: 0, pitch: 0 }
  let lastSent = { roll: 0, pitch: 0 }

  const set = (env: Partial<EnvState>) => {
    Object.assign(ctx.state.env, env)
    const c = ctx.state.env.current
    const speed = Math.hypot(c.x, c.z)
    const k = Math.min(1, speed / 0.6) * MAX_GITE
    target.roll = speed > 1e-3 ? (c.x / speed) * k : 0
    target.pitch = speed > 1e-3 ? (-c.z / speed) * k * 0.6 : 0
    ctx.bus.emit('weather:changed', { env: ctx.state.env })
  }

  const forecast = (): Partial<EnvState> => {
    const st = ctx.state
    const rng = ctx.rng(`meteo-${st.time.day}`)
    const roll = rng()
    const from: From = st.act === 1 ? 'sud' : FROM_ORDER[Math.floor(rng() * FROM_ORDER.length)]!
    const speed = st.act === 1 ? 0.3 : 0.2 + rng() * 0.45
    const f = FLOW[from]
    const current = { x: f.x * speed, y: 0, z: f.z * speed }
    if (st.act === 1) return { visibility: 30, current, jellyfish: 0.3, bloom: 0, rain: 0 }
    if (st.act === 2) {
      const k = northMornings(st.flags)
      const visibility = k <= 0 ? 60 : k === 1 ? 90 : 999
      return { visibility, current, jellyfish: roll < 0.25 ? 0.8 : 0.05, bloom: 0, rain: 0 }
    }
    const rain = st.flags['postgame'] ? (roll < 0.15 ? 1 : 0) : st.flags['pluie'] ? 1 : 0
    return { visibility: 999, current, jellyfish: 0.05, bloom: 0, rain }
  }

  // physics.gravity is the Drift-local vector the hero and rolling props fall along (BIBLE §0.1.4).
  const writeGravity = () => {
    const phys = ctx.physics as unknown as { gravity?: Vec3 }
    const g = phys.gravity ?? (phys.gravity = { x: 0, y: -9.81, z: 0 })
    g.x = 9.81 * Math.sin(gite.roll)
    g.y = -9.81 * Math.cos(gite.roll) * Math.cos(gite.pitch)
    g.z = -9.81 * Math.sin(gite.pitch)
  }

  ctx.bus.on('time:hour', ({ hour }) => {
    if (hour === 6) api.morning()
  })
  ctx.bus.on('time:phase', ({ phase }) => {
    const st = ctx.state
    if (phase === 'nuit' && st.time.day % 5 === 0) set({ bloom: 1 })
    else if (phase === 'aube' && st.env.bloom > 0) set({ bloom: 0 })
  })

  const api: Weather = {
    morning() {
      set(forecast())
    },
    set,
    gite: () => gite,
    condensation() {
      const st = ctx.state
      return st.act >= 2 && northMornings(st.flags) >= 1 && st.time.hours >= 5 && st.time.hours < 10
    },
    forecastText() {
      const env = ctx.state.env
      const parts: string[] = [UI.forecast.vis(env.visibility)]
      const speed = Math.hypot(env.current.x, env.current.z)
      if (speed < 0.05) parts.push(UI.forecast.courant(UI.from.calme))
      else {
        const ax = Math.abs(env.current.x)
        const az = Math.abs(env.current.z)
        const f: From = az >= ax ? (env.current.z < 0 ? 'sud' : 'nord') : env.current.x > 0 ? 'ouest' : 'est'
        parts.push(UI.forecast.courant(UI.from[f]))
      }
      parts.push(env.jellyfish >= 0.25 ? UI.forecast.meduses : UI.forecast.pasMeduses)
      if (env.bloom > 0.5 || ctx.state.time.day % 5 === 0) parts.push(UI.forecast.plancton)
      if (api.condensation()) parts.push(UI.forecast.buee)
      if (env.rain > 0.5) parts.push(UI.forecast.pluie)
      return parts.join(' · ')
    },
    update(dt) {
      const k = Math.min(1, dt * 0.35)
      gite.roll += (target.roll - gite.roll) * k
      gite.pitch += (target.pitch - gite.pitch) * k
      if (Math.abs(gite.roll - lastSent.roll) + Math.abs(gite.pitch - lastSent.pitch) > 0.002) {
        lastSent = { ...gite }
        gp.emit('gite:changed', { roll: gite.roll, pitch: gite.pitch })
        writeGravity()
      }
    },
  }
  return api
}
