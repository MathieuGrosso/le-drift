import { Room, validate, type Client } from '@colyseus/core'
import { LIMITS, windowCoat, type JoinOptions, type PlayerId, type ServerMessages } from '../../../src/shared/protocol'
import { authenticate } from '../identity'
import { MondeState, PlayerCard } from '../state'
import { clientMessages, joinOptions } from '../validate'
import { REAL_MS_PER_GAME_HOUR, gameHoursAt } from '../clock'
import { NET, TIME, WINDOWS } from '../../../src/core/tuning'
import type { RoomDeps } from './deps'

export function createMondeRoom(deps: RoomDeps) {
  return class MondeRoom extends Room<{ state: MondeState }> {
    override maxMessagesPerSecond = LIMITS.messagesPerSecond
    private readonly playerOf = new Map<string, PlayerId>()

    override messages = {
      scrub: validate(clientMessages.scrub, (_client: Client, m) => {
        const now = gameHoursAt(this.state.epochMs)
        const coat = windowCoat(this.state.windows.get(m.windowId), now, WINDOWS.sharedRegrowHours, WINDOWS.initialCoat)
        const scrubbedAt = now - Math.max(0, coat - m.amount) * WINDOWS.sharedRegrowHours
        this.state.windows.set(m.windowId, scrubbedAt)
        deps.store.world().windows[m.windowId] = scrubbedAt
      }),
      save: validate(clientMessages.save, (client: Client, m) => {
        const rec = deps.store.player(this.playerOf.get(client.sessionId) ?? '')
        if (rec) deps.store.putPlayer({ ...rec, save: m.save })
      }),
      profile: validate(clientMessages.profile, (client: Client, m) => {
        const id = this.playerOf.get(client.sessionId) ?? ''
        const rec = deps.store.player(id)
        const card = this.state.players.get(id)
        if (!rec || !card) return
        deps.store.putPlayer({ ...rec, profile: m })
        card.name = m.name
        card.color = m.color
      }),
    }

    override onCreate(): void {
      const world = deps.store.world()
      this.setState(new MondeState({
        epochMs: world.epochMs, realMsPerGameHour: REAL_MS_PER_GAME_HOUR, startHours: TIME.startHour,
      }))
      for (const [id, h] of Object.entries(world.windows)) this.state.windows.set(id, h)
    }

    override onAuth(_client: Client, raw: unknown) {
      const opts: JoinOptions = joinOptions.parse(raw)
      const rec = authenticate(deps.store, opts)
      if (!rec) throw new Error('identity')
      return rec
    }

    override onJoin(client: Client): void {
      const rec = deps.store.player(client.auth.id)!
      this.playerOf.set(client.sessionId, rec.id)
      this.state.players.set(rec.id, new PlayerCard({
        id: rec.id, name: rec.profile.name, color: rec.profile.color, district: rec.save?.hero.district ?? 'ecluse',
      }))
      const welcome: ServerMessages['welcome'] = { you: rec.id, save: rec.save, brains: deps.brains.enabled }
      client.send('welcome', welcome)
    }

    override onDrop(client: Client): void {
      const card = this.state.players.get(this.playerOf.get(client.sessionId) ?? '')
      if (card) card.status = 'absent'
      this.allowReconnection(client, NET.reconnectSeconds)
    }

    override onReconnect(client: Client): void {
      const card = this.state.players.get(this.playerOf.get(client.sessionId) ?? '')
      if (card) card.status = 'actif'
    }

    override onLeave(client: Client): void {
      const id = this.playerOf.get(client.sessionId)
      this.playerOf.delete(client.sessionId)
      if (id) this.state.players.delete(id)
    }
  }
}
