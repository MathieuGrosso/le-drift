import type { PlayerId } from '../../../src/shared/protocol'
import type { PersistencePort, PlayerRecord, Store, WorldRecord } from './port'

export const newWorld = (): WorldRecord => ({ epochMs: Date.now(), windows: {}, npcs: {}, tokens: { day: '', used: 0 } })

/** Write-behind cache over a port: rooms never await storage outside `onAuth`. */
export async function openStore(port: PersistencePort): Promise<Store> {
  const world = (await port.loadWorld()) ?? newWorld()
  const players = new Map<PlayerId, PlayerRecord>()
  const loading = new Map<PlayerId, Promise<PlayerRecord | null>>()
  const dirty = new Set<PlayerId>()
  let lastWorld = ''
  let flushing = Promise.resolve()

  const store: Store = {
    loadPlayer(id) {
      const cached = players.get(id)
      if (cached) return Promise.resolve(cached)
      let pending = loading.get(id)
      if (!pending) {
        pending = port.loadPlayer(id).then((rec) => {
          loading.delete(id)
          // A join that created the record while this read was in flight wins over the stored copy.
          const live = players.get(id)
          if (live) return live
          if (rec) players.set(id, rec)
          return rec
        }, (e: unknown) => {
          loading.delete(id)
          throw e
        })
        loading.set(id, pending)
      }
      return pending
    },
    player: (id) => players.get(id) ?? null,
    putPlayer(rec) {
      players.set(rec.id, rec)
      dirty.add(rec.id)
    },
    world: () => world,
    flush() {
      flushing = flushing.then(async () => {
        const ids = [...dirty]
        dirty.clear()
        try {
          if (ids.length) await port.savePlayers(ids.map((id) => players.get(id)!))
        } catch (e) {
          for (const id of ids) dirty.add(id)
          throw e
        }
        const json = JSON.stringify(world)
        if (json !== lastWorld) {
          await port.saveWorld(JSON.parse(json) as WorldRecord)
          lastWorld = json
        }
      }).catch((e: unknown) => console.error(`Le Drift : écriture impossible (${port.label})`, e))
      return flushing
    },
    async close() {
      await store.flush()
      await port.close()
    },
  }
  return store
}
