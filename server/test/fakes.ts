import { Avatar, PlayerCard } from '../src/state'
import type { PlayerRecord, Store, WorldRecord } from '../src/persist'

export function memoryStore(): Store {
  const players = new Map<string, PlayerRecord>()
  const world: WorldRecord = { epochMs: Date.now(), windows: {}, npcs: {}, tokens: { day: '', used: 0 } }
  return {
    loadPlayer: async (id) => players.get(id) ?? null,
    player: (id) => players.get(id) ?? null,
    putPlayer: (rec) => void players.set(rec.id, rec),
    world: () => world,
    flush: async () => undefined,
    close: async () => undefined,
  }
}

export const avatar = (id: string, name = id) => new Avatar({ id, name, color: 0, x: 0, y: 0, z: 0, yaw: 0 })
export const card = (id: string, name = id) => new PlayerCard({ id, name, color: 0, district: 'ecluse' })
