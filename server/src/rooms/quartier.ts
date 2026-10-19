import { Room, validate, type Client } from '@colyseus/core'
import { LIMITS, type ChatLine, type PlayerId, type QuartierJoinOptions } from '../../../src/shared/protocol'
import { NET } from '../../../src/core/tuning'
import { authenticate } from '../identity'
import { Avatar, QuartierState } from '../state'
import { clientMessages, quartierJoinOptions } from '../validate'
import type { RoomDeps } from './deps'

const CHAT_WINDOW_MS = 10_000

export function createQuartierRoom(deps: RoomDeps) {
  return class QuartierRoom extends Room<{ state: QuartierState }> {
    override maxMessagesPerSecond = LIMITS.messagesPerSecond
    private readonly playerOf = new Map<string, PlayerId>()
    private readonly chatTimes = new Map<PlayerId, number[]>()

    override messages = {
      move: validate(clientMessages.move, (client: Client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        ;[a.x, a.y, a.z] = m.p
        a.yaw = m.yaw
        a.mode = m.mode
        a.outside = m.outside
      }),
      chat: validate(clientMessages.chat, (client: Client, m) => {
        const a = this.avatarOf(client)
        if (!a || !this.chatAllowed(a.id)) return
        const line: ChatLine = { from: a.id, name: a.name, text: m.text, at: Date.now() }
        this.broadcast('chat', line)
      }),
      emote: validate(clientMessages.emote, (client: Client, m) => {
        const a = this.avatarOf(client)
        if (a) this.broadcast('emote', { from: a.id, emote: m.emote })
      }),
      sit: validate(clientMessages.sit, (client: Client, m) => {
        const a = this.avatarOf(client)
        if (a) a.seatId = m.seatId ?? ''
      }),
      talk: validate(clientMessages.talk, (client: Client, m) => {
        const id = this.playerOf.get(client.sessionId)
        if (id) void deps.brains.think(m.npcId, { kind: 'talk', player: id, text: m.text })
      }),
    }

    override onCreate(opts: { district: string }): void {
      this.setState(new QuartierState({ district: opts.district }))
      this.setPatchRate(1000 / NET.sendHz)
    }

    override onAuth(_client: Client, raw: unknown) {
      const opts: QuartierJoinOptions = quartierJoinOptions.parse(raw)
      const rec = authenticate(deps.store, opts)
      if (!rec) throw new Error('identity')
      return rec
    }

    override onJoin(client: Client): void {
      const rec = deps.store.player(client.auth.id)!
      this.playerOf.set(client.sessionId, rec.id)
      const p = rec.save?.hero.localPosition
      this.state.avatars.set(rec.id, new Avatar({
        id: rec.id, name: rec.profile.name, color: rec.profile.color, x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0, yaw: rec.save?.hero.yaw ?? 0,
      }))
    }

    override onDrop(client: Client): void {
      this.allowReconnection(client, NET.reconnectSeconds)
    }

    override onLeave(client: Client): void {
      const id = this.playerOf.get(client.sessionId)
      this.playerOf.delete(client.sessionId)
      if (!id) return
      this.state.avatars.delete(id)
      this.chatTimes.delete(id)
    }

    private avatarOf(client: Client): Avatar | undefined {
      return this.state.avatars.get(this.playerOf.get(client.sessionId) ?? '')
    }

    private chatAllowed(id: PlayerId): boolean {
      const now = Date.now()
      const times = (this.chatTimes.get(id) ?? []).filter((t) => now - t < CHAT_WINDOW_MS)
      if (times.length >= LIMITS.chatPerTenSeconds) return false
      times.push(now)
      this.chatTimes.set(id, times)
      return true
    }
  }
}
