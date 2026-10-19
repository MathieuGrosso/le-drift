import type { Gp } from '../context'
import { itemName } from '../inventory'
import { PROMPTS_MAISON } from '../../drift/homes/text'
import type { Uses } from './uses'

export function createHomes(gp: Gp, uses: Uses): void {
  const home = (owner: string) => gp.ctx.services.drift?.home(owner.replace(/^(habitant|mot)-/, '')) ?? null
  let talking = false

  const talk = async (id: string) => {
    const h = home(id)
    if (!h?.owner || talking) return
    talking = true
    gp.lock.count++
    try {
      const req = gp.progress().requests
      const key = `maison:${h.id}`
      const r = h.request
      if (r && req[key] === 'ask' && gp.inv.has(r.item)) {
        gp.inv.take(r.item)
        await gp.dialogue.play([[h.owner, r.thanks]])
        gp.inv.give(r.reward)
        req[key] = 'done'
        return
      }
      await gp.dialogue.play(h.lines.map((t) => [h.owner, t] as const))
      if (r && req[key] !== 'done') {
        await gp.dialogue.play([[h.owner, r.ask]])
        if (req[key] !== 'ask') gp.toast(PROMPTS_MAISON.demande(itemName(r.item)))
        req[key] = 'ask'
      }
    } finally {
      gp.lock.count--
      talking = false
    }
  }

  uses.on(/^habitant-maison-/, (owner) => {
    const h = home(owner)
    return h?.owner ? { label: PROMPTS_MAISON.parler(h.owner), kind: 'npc', reach: 2.2, run: () => void talk(owner) } : null
  })
  uses.on(/^mot-maison-/, (owner) => {
    const h = home(owner)
    return h?.note ? { label: PROMPTS_MAISON.lire, kind: 'item', reach: 2.2, run: () => gp.hud.tip(PROMPTS_MAISON.mot(h.note!), 5) } : null
  })
}
