import type { DistrictId } from '../../../src/core/types'
import type { Mood, NpcAction, NpcDecision, NpcGift, NpcPlace, PlayerId, SideQuestId } from '../../../src/shared/protocol'
import type { NpcRoomRegistry } from './rooms'

export type NpcTrigger =
  | { kind: 'tick' }
  | { kind: 'talk'; player: PlayerId; text: string | null }

export interface NpcSheet {
  id: string
  name: string
  district: DistrictId
  home: NpcPlace
  /** Character only; the shared world excerpt is a separate cached block placed before it. */
  persona: string
  scripted: readonly string[]
  gifts: readonly NpcGift[]
  quest: SideQuestId | null
}

/** The model's JSON: the protocol decision plus the rewritten memory of the player it talked to. */
export interface NpcThought extends NpcDecision {
  remember: string | null
}

export type Effort = 'low' | 'medium'
export type DecideFn = (sheet: NpcSheet, context: string, effort: Effort) => Promise<unknown>

/** The rooms as the brains see them; implemented by `NpcRoomRegistry`. */
export interface NpcWorld {
  playersIn(district: DistrictId): readonly PlayerId[]
  districtOf(player: PlayerId): DistrictId | null
  nameOf(player: PlayerId): string | null
  setCard(npcId: string, patch: { mood?: Mood; place?: NpcPlace; thinking?: boolean }): void
  apply(sheet: NpcSheet, actions: readonly NpcAction[], untilMs: number): void
}

export interface NpcBrains {
  readonly enabled: boolean
  readonly rooms: NpcRoomRegistry
  think(npcId: string, trigger: NpcTrigger): Promise<NpcAction[]>
  /** Something a player said in a district's chat; the NPCs there remember the last few. */
  observe(district: DistrictId, said: { player: PlayerId; name: string; text: string }): void
  dispose(): void
}
