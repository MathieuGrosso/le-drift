import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM } from '../../src/shared/protocol'
import { CONFIG } from './config'
import { createScriptedBrains } from './npc'
import { openStore } from './persist'
import { createMondeRoom } from './rooms/monde'
import { createQuartierRoom } from './rooms/quartier'
import { createPlayerLimits } from './rooms/limits'
import { createRegistry } from './rooms/registry'
import type { RoomDeps } from './rooms/deps'

const store = await openStore(CONFIG.dataDir)
const deps: RoomDeps = { store, brains: createScriptedBrains(), registry: createRegistry(), limits: createPlayerLimits() }

const server = defineServer({
  transport: new WebSocketTransport(),
  greet: false,
  rooms: {
    [ROOM.monde]: defineRoom(createMondeRoom(deps)),
    [ROOM.quartier]: defineRoom(createQuartierRoom(deps)).filterBy(['district']),
  },
})

const flusher = setInterval(() => void store.flush(), CONFIG.flushMs)
server.onShutdown(async () => {
  clearInterval(flusher)
  deps.brains.dispose()
  await store.flush()
})

await server.listen(CONFIG.port)
console.log(`Le Drift: ws://localhost:${CONFIG.port} (PNJ ${deps.brains.enabled ? 'Claude' : 'scriptés'})`)
