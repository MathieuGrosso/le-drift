import { strict as assert } from 'node:assert'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { authenticate } from '../src/identity'
import { jsonPersistence } from '../src/persist/json'
import { openStore } from '../src/persist/store'
import type { PersistencePort, PlayerRecord, WorldRecord } from '../src/persist/port'
import { PROTOCOL_VERSION, type JoinOptions } from '../../src/shared/protocol'

const join_ = (id: string, secret: string): JoinOptions => ({
  protocol: PROTOCOL_VERSION, identity: { id, secret }, profile: { name: 'Ilo', color: 0xd8644e },
})

function memoryPort(seed: PlayerRecord[] = []) {
  const players = new Map(seed.map((r) => [r.id, structuredClone(r)]))
  const writes: string[][] = []
  let world: WorldRecord | null = null
  let failNext = false
  const port: PersistencePort = {
    label: 'mémoire',
    loadWorld: async () => world,
    loadPlayer: async (id) => structuredClone(players.get(id) ?? null),
    async savePlayers(records) {
      if (failNext) {
        failNext = false
        throw new Error('hors ligne')
      }
      writes.push(records.map((r) => r.id))
      for (const r of records) players.set(r.id, structuredClone(r))
    },
    saveWorld: async (w) => void (world = w),
    close: async () => undefined,
  }
  return { port, players, writes, failOnce: () => void (failNext = true) }
}

test('a flush writes only the players that changed, and retries them after a failed write', async () => {
  const mem = memoryPort()
  const store = await openStore(mem.port)
  await authenticate(store, join_('a', 's'.repeat(32)))
  await authenticate(store, join_('b', 't'.repeat(32)))
  mem.failOnce()
  const quiet = console.error
  console.error = () => undefined
  await store.flush()
  console.error = quiet
  await store.flush()
  await store.flush()
  assert.deepEqual(mem.writes, [['a', 'b']])
  store.putPlayer({ ...store.player('a')!, seenAt: 1 })
  await store.flush()
  assert.deepEqual(mem.writes.at(-1), ['a'])
})

test('a returning player is read from the backend and must present the same secret', async () => {
  const mem = memoryPort()
  const first = await openStore(mem.port)
  await authenticate(first, join_('a', 's'.repeat(32)))
  await first.close()

  const restarted = await openStore(mem.port)
  assert.equal(restarted.player('a'), null)
  assert.equal(await authenticate(restarted, join_('a', 'x'.repeat(32))), null)
  assert.equal((await authenticate(restarted, join_('a', 's'.repeat(32))))?.id, 'a')
})

test('two joins of a new id racing on the backend read keep the first claim', async () => {
  const store = await openStore(memoryPort().port)
  const [a, b] = await Promise.all([authenticate(store, join_('a', 's'.repeat(32))), authenticate(store, join_('a', 'x'.repeat(32)))])
  assert.ok(a)
  assert.equal(b, null)
})

test('the JSON adapter survives a restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'drift-'))
  try {
    const store = await openStore(await jsonPersistence(dir))
    await authenticate(store, join_('a', 's'.repeat(32)))
    store.world().windows['w-1'] = 3
    await store.close()
    const again = await openStore(await jsonPersistence(dir))
    assert.equal((await again.loadPlayer('a'))?.profile.name, 'Ilo')
    assert.equal(again.world().windows['w-1'], 3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
