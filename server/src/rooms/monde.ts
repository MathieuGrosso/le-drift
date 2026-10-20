import { ErrorCode, Room, type Client } from '@colyseus/core'
import { CLOSE_TAKEN_OVER, LIMITS, ROOM, windowCoat, type JoinOptions, type PlayerId, type ServerMessages } from '../../../src/shared/protocol'
import { NET, TIME, WINDOWS } from '../../../src/core/tuning'
import { authenticate } from '../identity'
import { MondeState, PlayerCard } from '../state'
import { clientMessages, joinOptions } from '../validate'
import { REAL_MS_PER_GAME_HOUR, gameHoursAt } from '../clock'
import { GUARDS } from '../config'
import { createGuard, parseJoin, refuse, rejectJoin } from './guard'
import { Sessions } from './sessions'
import type { RoomDeps } from './deps'
import type { MondePort } from './registry'

export function createMondeRoom(deps: RoomDeps) {
  return class MondeRoom extends Room<{ state: MondeState }> {
    override maxMessagesPerSecond = LIMITS.messagesPerSecond
    private readonly sessions = new Sessions()
    private readonly guard = createGuard()

    private readonly port: MondePort = {
      updateCard: (id, patch) => {
        const card = this.state.players.get(id)
        if (!card) return
        if (patch.district !== undefined && card.district !== patch.district) card.district = patch.district
        if (patch.status !== undefined && card.status !== patch.status) card.status = patch.status
      },
      online: (id) => this.sessions.clientOf(id) !== null,
    }

    override messages = {
      scrub: this.guard.guarded(clientMessages.scrub, (client, m) => {
        if (!this.state.windows.has(m.windowId)) {
          const id = this.sessions.playerOf(client)
          if (!id || this.state.windows.size >= GUARDS.windowsMax) return refuse(client, 'invalid', 'fenêtre inconnue')
          if (!deps.limits.newWindow.allow(id)) return refuse(client, 'rate', 'Doucement.')
        }
        const now = gameHoursAt(this.state.epochMs)
        const coat = windowCoat(this.state.windows.get(m.windowId), now, WINDOWS.sharedRegrowHours, WINDOWS.initialCoat)
        const scrubbedAt = now - Math.max(0, coat - m.amount) * WINDOWS.sharedRegrowHours
        this.state.windows.set(m.windowId, scrubbedAt)
        deps.store.world().windows[m.windowId] = scrubbedAt
      }),
      save: this.guard.guarded(clientMessages.save, (client, m) => {
        const rec = deps.store.player(this.sessions.playerOf(client) ?? '')
        if (!rec) return
        if (!deps.limits.save.allow(rec.id)) return refuse(client, 'rate', 'Doucement.')
        deps.store.putPlayer({ ...rec, save: m.save, seenAt: Date.now() })
      }),
      profile: this.guard.guarded(clientMessages.profile, (client, m) => {
        const id = this.sessions.playerOf(client)
        const rec = deps.store.player(id ?? '')
        const card = this.state.players.get(id ?? '')
        if (!id || !rec || !card) return
        if (!deps.limits.profile.allow(id)) return refuse(client, 'rate', 'Doucement.')
        deps.store.putPlayer({ ...rec, profile: m })
        card.name = m.name
        card.color = m.color
        for (const q of deps.registry.quartiers()) q.updateProfile(id, m)
      }),
    }

    override onCreate(): void {
      const world = deps.store.world()
      this.setState(new MondeState({
        epochMs: world.epochMs, realMsPerGameHour: REAL_MS_PER_GAME_HOUR, startHours: TIME.startHour,
      }))
      for (const [id, h] of Object.entries(world.windows)) this.state.windows.set(id, h)
      deps.registry.attachMonde(this.port)
      deps.brains.rooms.addMonde(this.state)
    }

    override onDispose(): void {
      deps.registry.detachMonde(this.port)
    }

    override async onAuth(_client: Client, raw: unknown) {
      const opts: JoinOptions = parseJoin(ROOM.monde, joinOptions, raw)
      const rec = await authenticate(deps.store, opts)
      if (!rec) throw rejectJoin(ROOM.monde, 'identité', ErrorCode.AUTH_FAILED)
      return rec
    }

    override onJoin(client: Client): void {
      const rec = deps.store.player(client.auth.id)!
      const replaced = this.sessions.bind(client, rec.id)
      if (replaced) {
        replaced.leave(CLOSE_TAKEN_OVER)
        for (const q of deps.registry.quartiers()) q.evict(rec.id)
      }
      const live = [...deps.registry.quartiers()].find((q) => q.hosts(rec.id))
      this.state.players.set(rec.id, new PlayerCard({
        id: rec.id, name: rec.profile.name, color: rec.profile.color,
        district: live?.district() ?? rec.save?.hero.district ?? 'ecluse', status: live ? 'actif' : 'accueil',
      }))
      const welcome: ServerMessages['welcome'] = { you: rec.id, save: rec.save, brains: deps.brains.enabled }
      client.send('welcome', welcome)
    }

    override onDrop(client: Client, code?: number): void {
      if (code === CLOSE_TAKEN_OVER) return this.onLeave(client)
      const id = this.sessions.playerOf(client)
      if (id) this.port.updateCard(id, { status: 'absent' })
      // Rejects on expiry (onLeave follows) and during shutdown: both are expected.
      this.allowReconnection(client, NET.reconnectSeconds).catch(() => undefined)
    }

    override onReconnect(client: Client): void {
      const id = this.sessions.rebind(client)
      if (id) this.port.updateCard(id, { status: [...deps.registry.quartiers()].some((q) => q.hosts(id)) ? 'actif' : 'accueil' })
    }

    override onLeave(client: Client): void {
      this.guard.forget(client)
      const id: PlayerId | null = this.sessions.unbind(client)
      if (!id) return
      this.state.players.delete(id)
      const rec = deps.store.player(id)
      if (rec) deps.store.putPlayer({ ...rec, seenAt: Date.now() })
    }
  }
}
