import { LIMITS, sanitizeText, type PlayerId } from '../../../src/shared/protocol'
import type { MemoryEvent, NpcMemory, Store } from '../persist'
import { NPC_TUNING } from './tuning'

const EVENT_MAX = 200
const SUMMARY_MAX = 280

export interface Memories {
  recent(npcId: string): readonly MemoryEvent[]
  about(npcId: string, player: PlayerId): string | null
  note(npcId: string, event: MemoryEvent): void
  rewrite(npcId: string, player: PlayerId, summary: string): void
}

const clean = (e: MemoryEvent): MemoryEvent => {
  switch (e.kind) {
    case 'chat':
      return { kind: 'chat', who: sanitizeText(e.who, LIMITS.nameMax), text: sanitizeText(e.text, EVENT_MAX) }
    case 'visit':
      return { kind: 'visit', who: sanitizeText(e.who, LIMITS.nameMax) }
    case 'said':
      return { kind: 'said', text: sanitizeText(e.text, EVENT_MAX) }
  }
}

/** Short-term events and per-player summaries live in `world.json` so NPCs remember across restarts. */
export function createMemories(store: Store): Memories {
  const of = (npcId: string): NpcMemory => {
    const m = (store.world().npcs[npcId] ??= { shortTerm: [], perPlayer: {} })
    // Older saves held raw prose lines; they cannot be told apart from an injection, so they go.
    if (m.shortTerm.some((e) => typeof e !== 'object')) m.shortTerm = m.shortTerm.filter((e) => typeof e === 'object')
    return m
  }
  return {
    recent: (npcId) => of(npcId).shortTerm,
    about: (npcId, player) => of(npcId).perPlayer[player] ?? null,
    note(npcId, event) {
      const m = of(npcId)
      m.shortTerm.push(clean(event))
      if (m.shortTerm.length > NPC_TUNING.shortTermEvents) m.shortTerm.splice(0, m.shortTerm.length - NPC_TUNING.shortTermEvents)
    },
    rewrite(npcId, player, summary) {
      of(npcId).perPlayer[player] = sanitizeText(summary, SUMMARY_MAX)
    },
  }
}
