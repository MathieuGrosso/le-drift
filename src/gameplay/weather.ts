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

export function northMornings(flags: Record<string, boolean>): number {
  return Object.keys(flags).filter((k) => k.startsWith('nord-matin-') && flags[k]).length
}

export function createWeather(gp: Gp): Weather {
  const ctx = gp.ctx
  let from: From = 'sud'
  let dangerTimer = 0
  let inDanger = false

  const set = (env: Partial<EnvState>) => {
    Object.assign(ctx.state.env, env)
    ctx.bus.emit('weather:changed', { env: ctx.state.env })
  }

  const forecast = (): Partial<EnvState> => {
    const st = ctx.state
    const rng = ctx.rng(`meteo-${st.time.day}`)
    const roll = rng()
    from = st.act === 1 ? 'sud' : FROM_ORDER[Math.floor(rng() * FROM_ORDER.length)]!
    const speed = st.act === 1 ? 0.3 : 0.25 + rng() * 0.35
    const f = FLOW[from]
    const current = { x: f.x * speed, y: 0, z: f.z * speed }
    if (st.act === 1) return { visibility: 30, current, jellyfish: 0.3, bloom: 0, rain: 0 }
    if (st.act === 2) {
      const k = northMornings(st.flags)
      const visibility = k <= 0 ? 60 : k === 1 ? 90 : 999
      return { visibility, current, jellyfish: roll < 0.2 ? 0.8 : 0.05, bloom: 0, rain: 0 }
    }
    const rain = st.flags['postgame'] ? (roll < 0.15 ? 1 : 0) : st.flags['pluie'] ? 1 : 0
    return { visibility: 999, current, jellyfish: 0.05, bloom: 0, rain }
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
      if (env.bloom > 0.5) parts.push(UI.forecast.plancton)
      if (env.rain > 0.5) parts.push(UI.forecast.pluie)
      return parts.join(' · ')
    },
    update(dt) {
      dangerTimer -= dt
      if (dangerTimer > 0) return
      dangerTimer = 0.5
      const fauna = ctx.services.fauna
      if (!fauna || ctx.state.hero.medium === 'air') return
      const near = fauna.jellyfishNear(ctx.state.hero.position, 18) > 0
      if (near !== inDanger) {
        inDanger = near
        gp.cue(near ? 'danger' : 'explore')
      }
    },
  }
  return api
}
