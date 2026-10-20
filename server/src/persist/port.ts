import type { PlayerId, PlayerSave, Profile } from '../../../src/shared/protocol'

export interface PlayerRecord {
  id: PlayerId
  secretHash: string
  profile: Profile
  save: PlayerSave | null
  createdAt: number
  seenAt: number
}

/** Player-sourced fields are untrusted text, kept as data and only ever rendered JSON-encoded. */
export type MemoryEvent =
  | { kind: 'chat'; who: string; text: string }
  | { kind: 'visit'; who: string }
  | { kind: 'said'; text: string }

export interface NpcMemory {
  shortTerm: MemoryEvent[]
  perPlayer: Record<PlayerId, string>
}

export interface WorldRecord {
  epochMs: number
  windows: Record<string, number>
  npcs: Record<string, NpcMemory>
  tokens: { day: string; used: number }
}

/**
 * Where records live (JSON files, Postgres…). Only the store calls it, off the frame of any room:
 * reads on join, writes in batches on flush. An adapter never sees a half-built record.
 */
export interface PersistencePort {
  readonly label: string
  loadWorld(): Promise<WorldRecord | null>
  loadPlayer(id: PlayerId): Promise<PlayerRecord | null>
  savePlayers(records: readonly PlayerRecord[]): Promise<void>
  saveWorld(world: WorldRecord): Promise<void>
  close(): Promise<void>
}

/** What the rooms use: synchronous reads of records loaded at join, writes batched by `flush`. */
export interface Store {
  /** Must resolve before `player(id)` is trusted; rooms await it in `onAuth`. */
  loadPlayer(id: PlayerId): Promise<PlayerRecord | null>
  player(id: PlayerId): PlayerRecord | null
  putPlayer(rec: PlayerRecord): void
  world(): WorldRecord
  flush(): Promise<void>
  close(): Promise<void>
}
