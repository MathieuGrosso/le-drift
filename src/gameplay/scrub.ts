import type { Gp } from './context'
import { TIPS } from './text/fr'

const REACH = 2.0
const BASE = 0.25
const RUB = 0.85
const COST = 0.05

export interface ScrubTarget { id: string; coat: number; label?: string; scrub(amount: number): number }
export interface Scrub {
  target(): ScrubTarget | null
  addSource(fn: () => ScrubTarget | null): void
  scrubbing(): boolean
  update(dt: number): void
}

// Hold F against a coated pane; circling the mouse or the stick scrubs three times faster.
export function createScrub(gp: Gp): Scrub {
  const ctx = gp.ctx
  const sources: (() => ScrubTarget | null)[] = []
  let current: ScrubTarget | null = null
  let active = false
  let rub = 0
  let lastMove = { x: 0, y: 0 }
  let sfxT = 0

  sources.push(() => {
    const drift = ctx.services.drift
    const w = drift?.nearestWindow(gp.headPos(), REACH)
    if (!drift || !w || w.coat <= 0.02) return null
    return { id: w.id, coat: w.coat, scrub: (a) => drift.scrub(w.id, a) }
  })

  const find = (): ScrubTarget | null => {
    if (ctx.state.hero.medium !== 'water') return null
    for (let i = sources.length - 1; i >= 0; i--) {
      const t = sources[i]!()
      if (t) return t
    }
    return null
  }

  const stop = () => {
    if (!active) return
    active = false
    gp.heroMode('idle')
  }

  return {
    target: () => current,
    addSource: (fn) => sources.push(fn),
    scrubbing: () => active,
    update(dt) {
      current = gp.busy() ? null : find()
      const input = ctx.input
      if (!current || !input.down('scrub') || ctx.state.hero.exhausted) {
        rub = Math.max(0, rub - dt * 3)
        stop()
        return
      }
      if (!active) {
        active = true
        gp.heroMode('scrub')
        if (!ctx.state.flags['tip-frotter-cercles']) {
          ctx.state.flags['tip-frotter-cercles'] = true
          gp.hud.tip(TIPS.cercles, 6)
        }
      }
      const look = Math.hypot(input.look.x, input.look.y) / Math.max(dt, 1e-3)
      const m = input.move
      const turn = Math.abs(m.x * lastMove.y - m.y * lastMove.x) / Math.max(dt, 1e-3)
      lastMove = { x: m.x, y: m.y }
      const want = Math.min(1, look / 3 + turn / 6)
      rub += (want - rub) * Math.min(1, dt * 6)
      if (!gp.endurance.drain(COST * (1 + rub), dt)) {
        stop()
        return
      }
      const left = current.scrub((BASE + RUB * rub) * dt)
      sfxT -= dt
      if (sfxT <= 0) {
        sfxT = 0.34 - rub * 0.14
        gp.sfx('frotter')
      }
      gp.hud.progress(1 - left)
      if (left <= 0.02) stop()
    },
  }
}
