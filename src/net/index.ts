import type { NetService, System } from '../core/types'

/** Solo until client-net lands: the game must behave exactly as before when no server answers. */
export function createNetSystem(): System {
  const service: NetService = {
    status: () => 'solo',
    me: () => null,
    players: () => [],
    chat: () => undefined,
    emote: () => undefined,
    talk: () => false,
  }
  return {
    id: 'net',
    init(ctx) {
      ctx.services.net = service
      ctx.bus.emit('net:status', { status: 'solo' })
    },
    update() {},
    dispose() {},
  }
}
