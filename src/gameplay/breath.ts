import { MOVE, SOUFFLE } from '../core/tuning'
import type { Breath, Gp } from './context'

const STRONG_CURRENT = 5

export function createBreath(gp: Gp): Breath {
  const ctx = gp.ctx
  const buffs = new Map<'regen' | 'sprint' | 'bonus', number>()
  let sinceSpend = 99
  let wasFull = true
  let strongCurrent = false
  let currentTimer = 0

  const hero = () => ctx.state.hero

  const costMul = () => {
    let m = 1
    if (buffs.has('sprint') && ctx.input.down('sprint')) m *= 0.7
    if (hero().mode === 'climb' && strongCurrent) m *= MOVE.strongCurrentClimbMul
    return m
  }

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

  const api: Breath = {
    spend(cost) {
      const h = hero()
      if (h.medium === 'air') return true
      if (h.exhausted) return false
      h.breath -= cost * costMul()
      sinceSpend = 0
      if (h.breath <= 0) exhaust()
      return true
    },
    drain(rate, dt) {
      const h = hero()
      if (h.medium === 'air') return true
      if (h.exhausted) return false
      h.breath -= rate * costMul() * dt
      sinceSpend = 0
      if (h.breath <= 0) {
        exhaust()
        return false
      }
      return true
    },
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
    update(dt) {
      const h = hero()
      for (const [id, left] of buffs) {
        if (left - dt <= 0) buffs.delete(id)
        else buffs.set(id, left - dt)
      }
      const max = Math.min(SOUFFLE.max, SOUFFLE.base + SOUFFLE.perFourNacres * gp.inv.nacreUpgrades() + (buffs.has('bonus') ? 0.2 : 0))
      h.breathMax = max
      currentTimer -= dt
      if (currentTimer <= 0) {
        currentTimer = 0.25
        const c = ctx.services.world?.currentAt(h.position)
        strongCurrent = !!c && Math.hypot(c.x, c.y, c.z) > STRONG_CURRENT
      }
      if (h.medium === 'air' || ctx.state.flags['ending']) {
        h.breath = max
        h.exhausted = false
        sinceSpend = 99
      } else {
        sinceSpend += dt
        const bubble = gp.shallows.heroInBubble()
        let regen = 0
        if (bubble) regen = SOUFFLE.regenBubble
        else if (sinceSpend > SOUFFLE.regenDelay || h.exhausted) regen = SOUFFLE.regen * (buffs.has('regen') ? 1.5 : 1)
        h.breath = Math.min(max, h.breath + regen * dt)
        if (h.breath > max) h.breath = max
        if (h.exhausted && h.breath >= max) h.exhausted = false
      }
      const full = h.breath >= max - 1e-4 && !h.exhausted
      if (full && !wasFull) ctx.bus.emit('hero:breathFull', {})
      wasFull = full
    },
  }
  return api
}
