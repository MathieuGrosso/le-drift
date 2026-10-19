import { sanitizeText, type PlayerId } from '../../../src/shared/protocol'
import type { NpcMemory, Store } from '../persist'
import { NPC_TUNING } from './tuning'

const EVENT_MAX = 200

export interface Memories {
  recent(npcId: string): readonly string[]
  about(npcId: string, player: PlayerId): string | null
  note(npcId: string, event: string): void
  rewrite(npcId: string, player: PlayerId, summary: string): void
}

/** Short-term events and per-player summaries live in `world.json` so NPCs remember across restarts. */
export function createMemories(store: Store): Memories {
  const of = (npcId: string): NpcMemory => {
    const npcs = store.world().npcs
    return (npcs[npcId] ??= { shortTerm: [], perPlayer: {} })
  }
  return {
    recent: (npcId) => of(npcId).shortTerm,
    about: (npcId, player) => of(npcId).perPlayer[player] ?? null,
    note(npcId, event) {
      const m = of(npcId)
      m.shortTerm.push(sanitizeText(event, EVENT_MAX))
      if (m.shortTerm.length > NPC_TUNING.shortTermEvents) m.shortTerm.splice(0, m.shortTerm.length - NPC_TUNING.shortTermEvents)
    },
    rewrite(npcId, player, summary) {
      of(npcId).perPlayer[player] = summary
    },
  }
}
