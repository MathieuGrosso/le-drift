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

/** Writes `data` only when its JSON differs from the last write; tmp + rename so a crash never leaves half a file. */
function atomicWriter(path: string) {
  let last = ''
  return async (data: unknown): Promise<void> => {
    const json = JSON.stringify(data)
    if (json === last) return
    const tmp = `${path}.tmp`
    await writeFile(tmp, json)
    await rename(tmp, path)
    last = json
  }
}

export async function openStore(dir: string): Promise<Store> {
  await mkdir(dir, { recursive: true })
  const playersPath = join(dir, 'players.json')
  const worldPath = join(dir, 'world.json')
  const writePlayers = atomicWriter(playersPath)
  const writeWorld = atomicWriter(worldPath)
  let flushing = Promise.resolve()
  const players = new Map(Object.entries((await readJson<Record<PlayerId, PlayerRecord>>(playersPath)) ?? {}))
  const world: WorldRecord = (await readJson<WorldRecord>(worldPath)) ?? {
    epochMs: Date.now(), windows: {}, npcs: {}, tokens: { day: '', used: 0 },
  }
  return {
    player: (id) => players.get(id) ?? null,
    putPlayer: (rec) => void players.set(rec.id, rec),
    world: () => world,
    flush() {
      flushing = flushing.then(async () => {
        await writePlayers(Object.fromEntries(players))
        await writeWorld(world)
      }).catch((e: unknown) => console.error('Le Drift: écriture de la sauvegarde impossible', e))
      return flushing
    },
  }
}
