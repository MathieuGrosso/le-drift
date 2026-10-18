import type { Vec3 } from '../../core/types'
import type { Candidate, Collectibles, Gp } from '../context'
import { PROMPTS, TIPS, UI, trouvailleText } from '../text/fr'
import type { Uses } from './uses'

const REACH = 1.8

// Trouvailles: drift places and draws tr-01..tr-60 (and hides those listed in state.trouvailles); gameplay picks them up.
export function createCollectibles(gp: Gp, uses: Uses): Collectibles {
  const ctx = gp.ctx
  const found = (id: string) => ctx.state.trouvailles.includes(id)
  const index = (id: string) => Math.max(0, Number(id.slice(3)) - 1)

  const pick = (id: string) => {
    if (found(id)) return
    ctx.state.trouvailles.push(id)
    gp.inv.give(`trouvaille:${id}`, 1, true)
    const t = trouvailleText(index(id))
    gp.toast(`${UI.trouvaille} : ${t.nom}`)
    gp.hud.tip(ctx.state.trouvailles.length === 1 ? TIPS.trouvaille : t.enfants, 5)
    gp.sfx('discovery')
    ctx.bus.emit('collectible:found', { id })
    if (ctx.state.trouvailles.length % 5 === 0) {
      ctx.state.inventory.slots += 1
      gp.toast(UI.sacGrandit)
    }
  }

  uses.on(/^tr-\d\d$/, (owner) => (found(owner) ? null : { label: PROMPTS.ramasser, kind: 'item', run: () => pick(owner) }))

  return {
    candidates(out: Candidate[]) {
      const hl = gp.heroLocal()
      const spots: { id: string; at: Vec3 }[] = [...gp.sites.get().trouvailles]
      for (const a of gp.sites.near(hl, REACH + 1)) if (a.kind === 'trouvaille') spots.push({ id: a.id, at: a.at })
      for (const s of spots) {
        if (found(s.id) || out.some((c) => c.id === s.id)) continue
        const d = Math.hypot(hl.x - s.at.x, hl.y + 0.6 - s.at.y, hl.z - s.at.z)
        if (d < REACH) out.push({ id: s.id, kind: 'item', label: PROMPTS.ramasser, key: 'interact', dist: d - 0.3, run: () => pick(s.id) })
      }
    },
  }
}
