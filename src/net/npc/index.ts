import type { GameContext } from '../../core/types'
import { ITEMS, SPEAKERS } from '../../gameplay/text/fr'
import type { MondeStateView, NpcOrderView, NpcSay, PlayerId, QuartierStateView, ServerMessages } from '../../shared/protocol'

const TEXT = {
  thinking: '…',
  gives: (item: string) => `te donne : ${ITEMS[item]?.nom ?? item}.`,
  quest: 'a une petite demande pour toi.',
} as const

export interface NpcSink {
  line(name: string | null, text: string): void
  bubble(npcId: string, text: string): void
}

const orderKey = (o: NpcOrderView) => `${o.kind}|${o.place}|${o.emote}|${o.until}`
const npcName = (npcId: string) => SPEAKERS[npcId] ?? npcId

/** Plays server-decided NPC actions through the drift and gameplay services; never touches the network. */
export class NpcExecutor {
  private readonly applied = new Map<string, string>()
  private readonly thinking = new Set<string>()

  constructor(private readonly ctx: GameContext, private readonly sink: NpcSink) {}

  say(msg: NpcSay, me: PlayerId | null): void {
    // The reply can land before the patch that ends the thought: it must not be covered by a late « … ».
    this.thinking.add(msg.npcId)
    this.sink.bubble(msg.npcId, msg.text)
    if (msg.to !== null && msg.to === me) this.sink.line(npcName(msg.npcId), msg.text)
  }

  give(msg: ServerMessages['npc:give']): void {
    this.ctx.services.gameplay?.giveItem(msg.item, msg.count)
    this.sink.line(npcName(msg.npcId), TEXT.gives(msg.item))
  }

  quest(msg: ServerMessages['npc:quest']): void {
    this.sink.line(npcName(msg.npcId), TEXT.quest)
  }

  /** Called each frame with the synced state; only changed orders reach the drift. */
  sync(quartier: QuartierStateView | null, monde: MondeStateView | null): void {
    const drift = this.ctx.services.drift
    if (!drift) return
    const seen = new Set<string>()
    for (const [id, order] of quartier?.orders ?? []) {
      seen.add(id)
      const key = orderKey(order)
      if (this.applied.get(id) === key) continue
      this.applied.set(id, key)
      drift.npcOrder(id, order)
    }
    for (const id of this.applied.keys()) {
      if (seen.has(id)) continue
      this.applied.delete(id)
      drift.npcOrder(id, null)
    }
    for (const [id, card] of monde?.npcs ?? []) {
      if (card.thinking && !this.thinking.has(id) && card.district === quartier?.district) this.sink.bubble(id, TEXT.thinking)
      if (card.thinking) this.thinking.add(id)
      else this.thinking.delete(id)
    }
  }

  /** Back to solo: every NPC returns to its scripted routine. */
  reset(): void {
    for (const id of this.applied.keys()) this.ctx.services.drift?.npcOrder(id, null)
    this.applied.clear()
    this.thinking.clear()
  }
}
