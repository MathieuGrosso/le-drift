import type { Gp, Tours } from './context'
import { TOURNEE_GOSSIP, UI } from './text/fr'
import { PROUE_PANES } from './world/proue'

const LOOT = ['poisson', 'algue-rouge', 'moule', 'poisson', 'crevette', 'plancton'] as const

// La tournée: each morning the board asks for N windows; any coated window scrubbed on a sortie counts.
export function createTours(gp: Gp): Tours {
  const ctx = gp.ctx
  const seen = new Set<string>()
  let count = 0

  const target = () => {
    const s = ctx.state
    if (s.act === 1) return 2
    const r = ctx.rng(`tournee-${s.time.day}`)()
    return s.act === 2 ? 5 + Math.floor(r * 4) : 4
  }
  const dayKey = () => `tournee:${ctx.state.time.day}`

  ctx.bus.on('sortie:start', () => {
    if (ctx.state.flags[dayKey()]) count = Math.max(count, 0)
  })
  ctx.bus.on('scrub:done', ({ windowId }) => {
    const key = `${ctx.state.time.day}:${windowId}`
    if (windowId.startsWith('dome-proue')) return
    if (seen.has(key)) return
    seen.add(key)
    count++
    const rng = ctx.rng(`tournee-${key}`)
    if (rng() < 0.45) gp.inv.give(LOOT[Math.floor(rng() * LOOT.length)]!, 1)
    else if (rng() < 0.5) gp.hud.tip(TOURNEE_GOSSIP[Math.floor(rng() * TOURNEE_GOSSIP.length)]!, 4)
    gp.sfx('glass-tap')
    if (count >= target() && !ctx.state.flags[dayKey()]) {
      ctx.state.flags[dayKey()] = true
      gp.hud.card(UI.tourneeFinie, UI.tournee(count, target()), 2.6)
      gp.inv.give('poisson', 2, true)
      gp.inv.give('mie-du-cuistot', 1, true)
    }
  })
  ctx.bus.on('sleep:done', ({ fromHour, toHour }) => {
    if (toHour !== fromHour) count = 0
  })
  ctx.bus.on('time:hour', ({ hour }) => {
    if (hour === 6) count = 0
  })

  return {
    boardLines: () => [UI.forecast.tournee(target())],
    target,
    scrubbed: () => count,
    update() {
      const s = ctx.state
      const finale = gp.quests.step('a3-dome-proue') === 'sortie'
      const out = s.mode === 'sortie' || s.hero.medium === 'water'
      gp.hud.counter('tournee', out ? (finale ? UI.domeProue(Math.min(gp.proue.scrubbed(), PROUE_PANES), PROUE_PANES) : UI.tournee(Math.min(count, target()), target())) : null)
    },
  }
}
