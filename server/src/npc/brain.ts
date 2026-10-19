import type { NpcAction, PlayerId } from '../../../src/shared/protocol'

export type NpcTrigger =
  | { kind: 'tick' }
  | { kind: 'talk'; player: PlayerId; text: string | null }
  | { kind: 'event'; text: string }

export interface NpcSheet {
  id: string
  name: string
  district: string
  /** Character sheet + world bible excerpt: byte-stable so it stays in the prompt cache. */
  system: string
  scripted: readonly string[]
}

export interface NpcBrains {
  readonly enabled: boolean
  think(npcId: string, trigger: NpcTrigger): Promise<NpcAction[]>
  dispose(): void
}

export type DecideFn = (sheet: NpcSheet, context: string, effort: 'low' | 'medium') => Promise<unknown>
