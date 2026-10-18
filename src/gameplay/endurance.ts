import { SOUFFLE } from '../core/tuning'
import type { Endurance, Gp } from './context'

const SPRINT_INDOOR = 0.1

export function createEndurance(gp: Gp): Endurance {
  const ctx = gp.ctx
  const buffs = new Map<'regen' | 'sprint' | 'bonus', number>()
  let sinceSpend = 99
  let wasFull = true

  const hero = () => ctx.state.hero
  const costMul = () => (buffs.has('sprint') ? 0.7 : 1)

  const exhaust = () => {
    const h = hero()
    h.breath = 0
    if (!h.exhausted) {
      h.exhausted = true
      wasFull = false
      ctx.bus.emit('hero:breathEmpty', {})
      gp.sfx('essouffle')
    }
  }

  const use = (amount: number) => {
    const h = hero()
    if (ctx.state.flags['ending']) return true
    if (h.exhausted) return false
    h.breath -= amount * costMul()
    sinceSpend = 0
    if (h.breath <= 0) {
      exhaust()
      return false
    }
    return true
  }

  const api: Endurance = {
    spend: (cost) => use(cost),
    drain: (rate, dt) => use(rate * dt),
    canAct: () => !hero().exhausted,
    refill(amount) {
      const h = hero()
      h.breath = amount === undefined ? h.breathMax : Math.min(h.breathMax, h.breath + amount)
      if (h.breath >= h.breathMax) h.exhausted = false
    },
    addBuff(id, seconds) {
      buffs.set(id, seconds)
    },
    buffs: () => [...buffs.entries()].map(([id, left]) => ({ id, left })),
    recentlyUsed: () => sinceSpend < 1.5,
    update(dt) {
      const h = hero()
      for (const [id, left] of buffs) {
        if (left - dt <= 0) buffs.delete(id)
        else buffs.set(id, left - dt)
      }
      const max = Math.min(SOUFFLE.max, SOUFFLE.base + SOUFFLE.perFourNacres * gp.inv.nacreUpgrades() + (buffs.has('bonus') ? 0.2 : 0))
      h.breathMax = max
      const running = h.medium === 'air' && h.mode === 'walk' && ctx.input.down('sprint') && Math.hypot(ctx.input.move.x, ctx.input.move.y) > 0.2 && !gp.busy()
      if (running && !h.exhausted) use(SPRINT_INDOOR * dt)
      sinceSpend += dt
      const resting = h.mode === 'sit' || h.mode === 'sleep'
      if (sinceSpend > SOUFFLE.regenDelay || h.exhausted || resting) {
        const regen = SOUFFLE.regen * (buffs.has('regen') ? 1.5 : 1) * (resting ? 2 : 1)
        h.breath = Math.min(max, h.breath + regen * dt)
      }
      if (h.breath > max) h.breath = max
      if (h.exhausted && h.breath >= max) h.exhausted = false
      const full = h.breath >= max - 1e-4 && !h.exhausted
      if (full && !wasFull) ctx.bus.emit('hero:breathFull', {})
      wasFull = full
    },
  }
  return api
}
