import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PlayerId } from '../../../src/shared/protocol'
import type { PersistencePort, PlayerRecord, WorldRecord } from './port'

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

/** tmp + rename, so a crash never leaves half a file. */
async function writeAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(data))
  await rename(tmp, path)
}

/** `players.json` + `world.json` in one folder: the default, fine for tens of players. */
export async function jsonPersistence(dir: string): Promise<PersistencePort> {
  await mkdir(dir, { recursive: true })
  const playersPath = join(dir, 'players.json')
  const worldPath = join(dir, 'world.json')
  const players = new Map(Object.entries((await readJson<Record<PlayerId, PlayerRecord>>(playersPath)) ?? {}))
  return {
    label: `json ${dir}`,
    loadWorld: () => readJson<WorldRecord>(worldPath),
    loadPlayer: async (id) => players.get(id) ?? null,
    async savePlayers(records) {
      for (const r of records) players.set(r.id, r)
      await writeAtomic(playersPath, Object.fromEntries(players))
    },
    saveWorld: (world) => writeAtomic(worldPath, world),
    close: async () => undefined,
  }
}
