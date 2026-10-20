import type { Client } from '@colyseus/core'
import type { PlayerId } from '../../../src/shared/protocol'

/** One live session per player per room; the monde room extends it across rooms (see MondePort). */
export class Sessions {
  private readonly byClient = new Map<string, PlayerId>()
  private readonly byPlayer = new Map<PlayerId, Client>()

  /** Returns the session this one replaces, for the caller to close. */
  bind(client: Client, id: PlayerId): Client | null {
    const previous = this.byPlayer.get(id)
    this.byClient.set(client.sessionId, id)
    this.byPlayer.set(id, client)
    return previous && previous.sessionId !== client.sessionId ? previous : null
  }

  rebind(client: Client): PlayerId | null {
    const id = this.byClient.get(client.sessionId)
    if (!id) return null
    this.byPlayer.set(id, client)
    return id
  }

  /** The player id, only if this session still owns it (a replaced session must not tear down its successor). */
  unbind(client: Client): PlayerId | null {
    const id = this.byClient.get(client.sessionId)
    this.byClient.delete(client.sessionId)
    if (!id || this.byPlayer.get(id)?.sessionId !== client.sessionId) return null
    this.byPlayer.delete(id)
    return id
  }

  clientOf(id: PlayerId): Client | null {
    return this.byPlayer.get(id) ?? null
  }

  playerOf(client: Client): PlayerId | null {
    const id = this.byClient.get(client.sessionId)
    return id && this.byPlayer.get(id)?.sessionId === client.sessionId ? id : null
  }
}
