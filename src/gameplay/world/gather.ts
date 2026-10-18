import type { Candidate, Gp } from '../context'
import { GATHER, PROMPTS } from '../text/fr'

interface Spot { cells: readonly string[]; items: readonly string[]; perDay: number; label: string; done: string }

// Ingredients grow where drift put the gardens and the engines; gameplay only keeps the daily count.
const SPOTS: readonly Spot[] = [
  { cells: ['serre-cathedrale'], items: ['algue-rouge', 'algue-doree', 'algue-rouge'], perDay: 4, label: PROMPTS.cueillir, done: GATHER.serreVide },
  { cells: ['puits', 'puits-echelle'], items: ['sel-de-machine', 'moule', 'sel-de-machine'], perDay: 3, label: PROMPTS.racler, done: GATHER.puitsVide },
  { cells: ['ateliers'], items: ['oursin', 'crevette'], perDay: 2, label: PROMPTS.bacs, done: GATHER.bacsVides },
  { cells: ['grand-marche'], items: ['moule', 'poisson'], perDay: 1, label: PROMPTS.ramasserTombe, done: GATHER.marcheVide },
]

export interface Gather {
  candidates(out: Candidate[]): void
}

export function createGather(gp: Gp): Gather {
  const ctx = gp.ctx
  let cooldown = 0
  let last = -1

  const take = (spot: Spot, key: string) => {
    const st = ctx.state
    let n = 0
    while (st.flags[`${key}#${n}`]) n++
    if (n >= spot.perDay) {
      gp.hud.tip(spot.done, 3)
      return
    }
    const id = spot.items[(n + st.time.day) % spot.items.length]!
    if (!gp.inv.give(id, 1)) return
    st.flags[`${key}#${n}`] = true
    gp.sfx('cueillette')
    cooldown = 1.2
  }

  return {
    candidates(out) {
      const now = ctx.clock.elapsed
      if (last >= 0) cooldown = Math.max(0, cooldown - (now - last))
      last = now
      if (cooldown > 0 || ctx.state.hero.medium !== 'air') return
      const cell = gp.sites.cellOf(gp.heroLocal())
      if (!cell) return
      for (const spot of SPOTS) {
        if (!spot.cells.includes(cell)) continue
        const key = `cueillette:${spot.cells[0]}:${ctx.state.time.day}`
        out.push({ id: key, kind: 'item', label: spot.label, key: 'interact', dist: 4.5, run: () => take(spot, key) })
      }
    },
  }
}
