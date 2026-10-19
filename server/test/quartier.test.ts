import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Client } from '@colyseus/core'
import { LIMITS } from '../../src/shared/protocol'
import { createScriptedBrains } from '../src/npc'
import { createPlayerLimits } from '../src/rooms/limits'
import { createQuartierRoom } from '../src/rooms/quartier'
import { createRegistry } from '../src/rooms/registry'
import type { RoomDeps } from '../src/rooms/deps'
import { avatar, memoryStore } from './fakes'

const deps = (): RoomDeps => ({ store: memoryStore(), brains: createScriptedBrains(), registry: createRegistry(), limits: createPlayerLimits() })

test('a client cannot create a district room for a district that does not exist', () => {
  const d = deps()
  const Quartier = createQuartierRoom(d)
  for (const district of ['nowhere', '__proto__', 'constructor', 42, undefined]) {
    const room = new Quartier()
    assert.throws(() => room.onCreate({ district }))
    assert.doesNotThrow(() => room.onDispose())
  }
  assert.equal([...d.registry.quartiers()].length, 0)
  assert.deepEqual(d.brains.rooms.playersIn('ecluse'), [])
})

test('a second room for a live district is refused and the live one keeps the NPCs', () => {
  const d = deps()
  const Quartier = createQuartierRoom(d)
  const live = new Quartier()
  live.onCreate({ district: 'ecluse' })
  live.state.avatars.set('p1', avatar('p1'))
  const intruder = new Quartier()
  assert.throws(() => intruder.onCreate({ district: 'ecluse' }), /déjà ouvert/)
  assert.deepEqual(d.brains.rooms.playersIn('ecluse'), ['p1'])
  assert.equal([...d.registry.quartiers()].length, 1)
  intruder.onDispose()
  assert.deepEqual(d.brains.rooms.playersIn('ecluse'), ['p1'])
})

test('leaving and rejoining a district does not reset the chat limit', () => {
  const d = deps()
  const id = 'p1'
  d.store.putPlayer({ id, secretHash: '', profile: { name: 'Ilo', color: 0 }, save: null, createdAt: 0, seenAt: 0 })
  const Quartier = createQuartierRoom(d)
  let session = 0
  const refusals: string[] = []
  const join = () => {
    const room = new Quartier()
    room.onCreate({ district: 'ecluse' })
    const client = {
      sessionId: `s${++session}`, auth: { id }, leave: () => undefined,
      send: (type: string, m: { reason: string }) => void (type === 'refused' && refusals.push(m.reason)),
    } as unknown as Client
    room.onJoin(client)
    return { room, client }
  }
  let { room, client } = join()
  for (let i = 0; i < LIMITS.chatPerTenSeconds; i++) room.messages.chat(client, { text: `ligne ${i}` })
  assert.deepEqual(refusals, [])
  room.onLeave(client)
  room.onDispose()
  ;({ room, client } = join())
  room.messages.chat(client, { text: 'encore' })
  assert.deepEqual(refusals, ['rate'])
})
