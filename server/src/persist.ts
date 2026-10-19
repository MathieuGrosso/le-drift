import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PlayerId, PlayerSave, Profile } from '../../src/shared/protocol'

export interface PlayerRecord {
  id: PlayerId
  secretHash: string
  profile: Profile
  save: PlayerSave | null
  createdAt: number
  seenAt: number
}

export interface NpcMemory {
  shortTerm: string[]
  perPlayer: Record<PlayerId, string>
}

export interface WorldRecord {
  epochMs: number
  windows: Record<string, number>
  npcs: Record<string, NpcMemory>
  tokens: { day: string; used: number }
}

export interface Store {
  player(id: PlayerId): PlayerRecord | null
  putPlayer(rec: PlayerRecord): void
  world(): WorldRecord
  flush(): Promise<void>
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

async function writeAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(data))
  await rename(tmp, path)
}

export async function openStore(dir: string): Promise<Store> {
  await mkdir(dir, { recursive: true })
  const playersPath = join(dir, 'players.json')
  const worldPath = join(dir, 'world.json')
  const players = new Map(Object.entries((await readJson<Record<PlayerId, PlayerRecord>>(playersPath)) ?? {}))
  const world: WorldRecord = (await readJson<WorldRecord>(worldPath)) ?? {
    epochMs: Date.now(), windows: {}, npcs: {}, tokens: { day: '', used: 0 },
  }
  return {
    player: (id) => players.get(id) ?? null,
    putPlayer: (rec) => void players.set(rec.id, rec),
    world: () => world,
    async flush() {
      await writeAtomic(playersPath, Object.fromEntries(players))
      await writeAtomic(worldPath, world)
    },
  }
}
