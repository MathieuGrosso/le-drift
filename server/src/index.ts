import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM } from '../../src/shared/protocol'
import { CONFIG } from './config'
import { createBrains } from './npc'
import { configuredPersistence, openStore } from './persist'
import { createMondeRoom } from './rooms/monde'
import { createQuartierRoom } from './rooms/quartier'
import { createPlayerLimits } from './rooms/limits'
import { createRegistry } from './rooms/registry'
import type { RoomDeps } from './rooms/deps'

const store = await openStore(await configuredPersistence())
const brains = await createBrains(store, CONFIG.npcScripted ? { credentials: async () => false } : {})
console.log(brains.enabled
  ? `PNJ Claude : ${CONFIG.npcModel}, ${CONFIG.npcDailyTokens} jetons par jour`
  : `PNJ scriptés : ${CONFIG.npcScripted ? 'NPC_BRAINS=scripted' : 'aucun identifiant Claude (ANTHROPIC_API_KEY ou ant auth login)'}`)
const deps: RoomDeps = { store, brains, registry: createRegistry(), limits: createPlayerLimits() }

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
  await store.close()
})

await server.listen(CONFIG.port)
console.log(`Le Drift: ws://localhost:${CONFIG.port}`)
