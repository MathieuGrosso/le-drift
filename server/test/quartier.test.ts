import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createScriptedBrains } from '../src/npc'
import { createQuartierRoom } from '../src/rooms/quartier'
import { createRegistry } from '../src/rooms/registry'
import type { RoomDeps } from '../src/rooms/deps'
import { avatar, memoryStore } from './fakes'

const deps = (): RoomDeps => ({ store: memoryStore(), brains: createScriptedBrains(), registry: createRegistry() })

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
