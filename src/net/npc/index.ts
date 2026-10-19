import type { DriftService, GameContext, GameplayService } from '../../core/types'
import { ITEMS, SPEAKERS } from '../../gameplay/text/fr'
import type { MondeStateView, NpcOrderView, NpcSay, PlayerId, QuartierStateView, ServerMessages, SideQuestId } from '../../shared/protocol'

// Hooks gameplay-adapt adds (MULTI §7); until they land, lines fall back to the chat log and orders are skipped.
type NpcDrift = DriftService & Partial<{ npcSay(npcId: string, text: string): void; npcOrder(npcId: string, order: NpcOrderView | null): void }>
type NpcGameplay = GameplayService & Partial<{ startSideQuest(questId: SideQuestId, npcId: string): void }>

const TEXT = {
  thinking: '…',
  gives: (item: string) => `te donne : ${ITEMS[item]?.nom ?? item}.`,
  quest: 'a une petite demande pour toi.',
} as const

export interface NpcLog {
  line(name: string | null, text: string): void
}

const orderKey = (o: NpcOrderView) => `${o.kind}|${o.place}|${o.emote}|${o.until}`
const npcName = (npcId: string) => SPEAKERS[npcId] ?? npcId

/** Plays server-decided NPC actions through the drift and gameplay services; never touches the network. */
export class NpcExecutor {
  private readonly applied = new Map<string, string>()
  private readonly thinking = new Set<string>()

  constructor(private readonly ctx: GameContext, private readonly log: NpcLog) {}

  say(msg: NpcSay, me: PlayerId | null): void {
    const drift = this.drift()
    const forMe = msg.to !== null && msg.to === me
    if (drift?.npcSay) drift.npcSay(msg.npcId, msg.text)
    if (forMe || !drift?.npcSay) this.log.line(npcName(msg.npcId), msg.text)
  }

  give(msg: ServerMessages['npc:give']): void {
    this.ctx.services.gameplay?.giveItem(msg.item, msg.count)
    this.log.line(npcName(msg.npcId), TEXT.gives(msg.item))
  }

  quest(msg: ServerMessages['npc:quest']): void {
    const gp: NpcGameplay | undefined = this.ctx.services.gameplay
    gp?.startSideQuest?.(msg.questId, msg.npcId)
    this.log.line(npcName(msg.npcId), TEXT.quest)
  }

  /** Called each frame with the synced state; only changed orders reach the drift. */
  sync(quartier: QuartierStateView | null, monde: MondeStateView | null): void {
    const drift = this.drift()
    if (!drift?.npcOrder) return
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
      if (card.thinking && !this.thinking.has(id) && card.district === quartier?.district) drift.npcSay?.(id, TEXT.thinking)
      if (card.thinking) this.thinking.add(id)
      else this.thinking.delete(id)
    }
  }

  /** Back to solo: every NPC returns to its scripted routine. */
  reset(): void {
    const drift = this.drift()
    for (const id of this.applied.keys()) drift?.npcOrder?.(id, null)
    this.applied.clear()
    this.thinking.clear()
  }

  private drift(): NpcDrift | undefined {
    return this.ctx.services.drift
  }
}
