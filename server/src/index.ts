import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM } from '../../src/shared/protocol'
import { CONFIG } from './config'
import { createScriptedBrains } from './npc'
import { openStore } from './persist'
import { createMondeRoom } from './rooms/monde'
import { createQuartierRoom } from './rooms/quartier'

const FLUSH_MS = 10_000

const store = await openStore(CONFIG.dataDir)
const deps = { store, brains: createScriptedBrains() }

const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    [ROOM.monde]: defineRoom(createMondeRoom(deps)),
    [ROOM.quartier]: defineRoom(createQuartierRoom(deps)).filterBy(['district']),
  },
})

const flusher = setInterval(() => void store.flush(), FLUSH_MS)
server.onShutdown(async () => {
  clearInterval(flusher)
  deps.brains.dispose()
  await store.flush()
})

await server.listen(CONFIG.port)
console.log(`Le Drift: ws://localhost:${CONFIG.port} (PNJ ${deps.brains.enabled ? 'Claude' : 'scriptés'})`)
