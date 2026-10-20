import { ErrorCode, Room, type Client } from '@colyseus/core'
import {
  CLOSE_TAKEN_OVER, LIMITS, ROOM, type ChatLine, type PlayerCardView, type PlayerId, type QuartierJoinOptions,
} from '../../../src/shared/protocol'
import { NET } from '../../../src/core/tuning'
import { DISTRICT_BY_ID, type DistrictDef } from '../../../src/core/layout'
import type { DistrictId } from '../../../src/core/types'
import { authenticate } from '../identity'
import { Avatar, QuartierState } from '../state'
import { clientMessages, quartierCreateOptions, quartierJoinOptions } from '../validate'
import { createGuard, parseJoin, refuse, rejectJoin } from './guard'
import { constrainMove, type Tracked } from './movement'
import { Sessions } from './sessions'
import type { RoomDeps } from './deps'
import type { QuartierPort } from './registry'

const statusOf = (mode: string, outside: boolean): PlayerCardView['status'] =>
  mode === 'sleep' ? 'dort' : outside ? 'dehors' : 'actif'

export function createQuartierRoom(deps: RoomDeps) {
  return class QuartierRoom extends Room<{ state: QuartierState }> {
    override maxMessagesPerSecond = LIMITS.messagesPerSecond
    private readonly sessions = new Sessions()
    private readonly guard = createGuard()
    private readonly tracked = new Map<PlayerId, Tracked>()
    private district!: DistrictId
    private box!: DistrictDef

    private readonly port: QuartierPort = {
      updateProfile: (id, profile) => {
        const a = this.state.avatars.get(id)
        if (!a) return
        a.name = profile.name
        a.color = profile.color
      },
      district: () => this.district,
      hosts: (id) => this.sessions.clientOf(id) !== null,
      evict: (id) => this.sessions.clientOf(id)?.leave(CLOSE_TAKEN_OVER),
    }

    override messages = {
      move: this.guard.guarded(clientMessages.move, (client, m) => {
        const id = this.sessions.playerOf(client)
        const a = this.state.avatars.get(id ?? '')
        const prev = this.tracked.get(id ?? '')
        if (!id || !a || !prev) return
        const next = constrainMove(prev, m.p, this.box, Date.now())
        this.tracked.set(id, next)
        a.x = next.x
        a.y = next.y
        a.z = next.z
        a.yaw = m.yaw
        a.mode = m.mode
        a.outside = m.outside
        deps.registry.monde()?.updateCard(id, { status: statusOf(m.mode, m.outside) })
      }),
      away: this.guard.guarded(clientMessages.away, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (m.away) a.mode = 'idle'
        deps.registry.monde()?.updateCard(a.id, { status: m.away ? 'absent' : statusOf(a.mode, a.outside) })
      }),
      chat: this.guard.guarded(clientMessages.chat, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!deps.limits.chat.allow(a.id)) return refuse(client, 'rate', 'Doucement, laisse parler les autres.')
        const line: ChatLine = { from: a.id, name: a.name, text: m.text, at: Date.now() }
        this.broadcast('chat', line)
        deps.brains.observe(this.district, { player: a.id, name: a.name, text: m.text })
      }),
      emote: this.guard.guarded(clientMessages.emote, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!deps.limits.action.allow(a.id)) return refuse(client, 'rate', 'Doucement.')
        this.broadcast('emote', { from: a.id, emote: m.emote })
      }),
      sit: this.guard.guarded(clientMessages.sit, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!deps.limits.action.allow(a.id)) return refuse(client, 'rate', 'Doucement.')
        const seat = m.seatId ?? ''
        const taken = seat !== '' && [...this.state.avatars.values()].some((o) => o.id !== a.id && o.seatId === seat)
        if (taken) return refuse(client, 'invalid', 'Cette place est prise.')
        a.seatId = seat
      }),
      talk: this.guard.guarded(clientMessages.talk, (client, m) => {
        const id = this.sessions.playerOf(client)
        if (!id) return
        if (!deps.limits.talk.allow(id)) return refuse(client, 'rate', 'Laisse-lui le temps de répondre.')
        deps.brains.think(m.npcId, { kind: 'talk', player: id, text: m.text })
          .catch((e: unknown) => console.error(`PNJ ${m.npcId} : ${e instanceof Error ? e.message : 'erreur'}`))
      }),
    }

    /** Any client can ask to create a room: the district is validated and a live one is never replaced. */
    override onCreate(raw: unknown): void {
      const { district } = parseJoin(ROOM.quartier, quartierCreateOptions, raw)
      this.district = district
      this.box = DISTRICT_BY_ID[district]
      this.setState(new QuartierState({ district }))
      if (!deps.brains.rooms.addQuartier(this)) throw rejectJoin(ROOM.quartier, `${district} déjà ouvert`)
      this.setPatchRate(1000 / NET.sendHz)
      deps.registry.attachQuartier(this.port)
    }

    override onDispose(): void {
      deps.registry.detachQuartier(this.port)
      // A refused onCreate is disposed too, before it ever had a state.
      if (this.district) deps.brains.rooms.removeQuartier(this)
    }

    override async onAuth(_client: Client, raw: unknown) {
      const opts: QuartierJoinOptions = parseJoin(ROOM.quartier, quartierJoinOptions, raw)
      if (opts.district !== this.district) throw rejectJoin(ROOM.quartier, `${opts.district} demandé dans ${this.district}`)
      const rec = await authenticate(deps.store, opts)
      if (!rec) throw rejectJoin(ROOM.quartier, 'identité', ErrorCode.AUTH_FAILED)
      if (!deps.registry.monde()?.online(rec.id)) throw rejectJoin(ROOM.quartier, 'pas à bord du Drift')
      return rec
    }

    override onJoin(client: Client): void {
      const rec = deps.store.player(client.auth.id)!
      this.sessions.bind(client, rec.id)?.leave(CLOSE_TAKEN_OVER)
      const saved = rec.save?.hero.district === this.district ? rec.save.hero.localPosition : null
      const p = saved ?? { x: (this.box.x0 + this.box.x1) / 2, y: this.box.y0, z: (this.box.z0 + this.box.z1) / 2 }
      // at: 0 lets the first reported position replace this guess without spending the teleport.
      this.tracked.set(rec.id, { ...p, at: 0, teleportAt: -Infinity })
      this.state.avatars.set(rec.id, new Avatar({
        id: rec.id, name: rec.profile.name, color: rec.profile.color, x: p.x, y: p.y, z: p.z, yaw: rec.save?.hero.yaw ?? 0,
      }))
      deps.registry.monde()?.updateCard(rec.id, { district: this.district, status: 'actif' })
    }

    override onDrop(client: Client, code?: number): void {
      if (code === CLOSE_TAKEN_OVER) return this.onLeave(client)
      // Rejects on expiry (onLeave follows) and during shutdown: both are expected.
      this.allowReconnection(client, NET.reconnectSeconds).catch(() => undefined)
    }

    override onReconnect(client: Client): void {
      this.sessions.rebind(client)
    }

    override onLeave(client: Client): void {
      this.guard.forget(client)
      const id = this.sessions.unbind(client)
      if (!id) return
      this.state.avatars.delete(id)
      this.tracked.delete(id)
    }

    private avatarOf(client: Client): Avatar | undefined {
      return this.state.avatars.get(this.sessions.playerOf(client) ?? '')
    }
  }
}
