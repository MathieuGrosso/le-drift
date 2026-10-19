import { Room, type Client } from '@colyseus/core'
import {
  LIMITS, type ChatLine, type PlayerCardView, type PlayerId, type QuartierJoinOptions,
} from '../../../src/shared/protocol'
import { NET } from '../../../src/core/tuning'
import { DISTRICT_BY_ID, type DistrictDef } from '../../../src/core/layout'
import type { DistrictId } from '../../../src/core/types'
import { authenticate } from '../identity'
import { GUARDS } from '../config'
import { Avatar, QuartierState } from '../state'
import { clientMessages, quartierCreateOptions, quartierJoinOptions } from '../validate'
import { createRateLimit } from '../rate'
import { createGuard, refuse } from './guard'
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
    private readonly chatLimit = createRateLimit(LIMITS.chatPerTenSeconds, GUARDS.chatWindowMs)
    private readonly talkLimit = createRateLimit(LIMITS.chatPerTenSeconds, GUARDS.chatWindowMs)
    private readonly actionLimit = createRateLimit(GUARDS.actionsPerWindow, GUARDS.actionWindowMs)
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
      chat: this.guard.guarded(clientMessages.chat, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!this.chatLimit.allow(a.id)) return refuse(client, 'rate', 'Doucement, laisse parler les autres.')
        const line: ChatLine = { from: a.id, name: a.name, text: m.text, at: Date.now() }
        this.broadcast('chat', line)
        deps.brains.observe(this.district, { player: a.id, name: a.name, text: m.text })
      }),
      emote: this.guard.guarded(clientMessages.emote, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!this.actionLimit.allow(a.id)) return refuse(client, 'rate', 'Doucement.')
        this.broadcast('emote', { from: a.id, emote: m.emote })
      }),
      sit: this.guard.guarded(clientMessages.sit, (client, m) => {
        const a = this.avatarOf(client)
        if (!a) return
        if (!this.actionLimit.allow(a.id)) return refuse(client, 'rate', 'Doucement.')
        const seat = m.seatId ?? ''
        const taken = seat !== '' && [...this.state.avatars.values()].some((o) => o.id !== a.id && o.seatId === seat)
        if (taken) return refuse(client, 'invalid', 'Cette place est prise.')
        a.seatId = seat
      }),
      talk: this.guard.guarded(clientMessages.talk, (client, m) => {
        const id = this.sessions.playerOf(client)
        if (!id) return
        if (!this.talkLimit.allow(id)) return refuse(client, 'rate', 'Laisse-lui le temps de répondre.')
        deps.brains.think(m.npcId, { kind: 'talk', player: id, text: m.text })
          .catch((e: unknown) => console.error(`PNJ ${m.npcId} : ${e instanceof Error ? e.message : 'erreur'}`))
      }),
    }

    /** Any client can ask to create a room: the district is validated and a live one is never replaced. */
    override onCreate(raw: unknown): void {
      const { district } = quartierCreateOptions.parse(raw)
      this.district = district
      this.box = DISTRICT_BY_ID[district]
      this.setState(new QuartierState({ district }))
      if (!deps.brains.rooms.addQuartier(this)) throw new Error(`quartier ${district} déjà ouvert`)
      this.setPatchRate(1000 / NET.sendHz)
      deps.registry.attachQuartier(this.port)
    }

    override onDispose(): void {
      deps.registry.detachQuartier(this.port)
      // A refused onCreate is disposed too, before it ever had a state.
      if (this.district) deps.brains.rooms.removeQuartier(this)
    }

    override onAuth(_client: Client, raw: unknown) {
      const opts: QuartierJoinOptions = quartierJoinOptions.parse(raw)
      if (opts.district !== this.district) throw new Error('district')
      const rec = authenticate(deps.store, opts)
      if (!rec) throw new Error('identity')
      return rec
    }

    override onJoin(client: Client): void {
      const rec = deps.store.player(client.auth.id)!
      this.sessions.bind(client, rec.id)?.leave()
      const saved = rec.save?.hero.district === this.district ? rec.save.hero.localPosition : null
      const p = saved ?? { x: (this.box.x0 + this.box.x1) / 2, y: this.box.y0, z: (this.box.z0 + this.box.z1) / 2 }
      // at: 0 lets the first reported position replace this guess without spending the teleport.
      this.tracked.set(rec.id, { ...p, at: 0, teleportAt: -Infinity })
      this.state.avatars.set(rec.id, new Avatar({
        id: rec.id, name: rec.profile.name, color: rec.profile.color, x: p.x, y: p.y, z: p.z, yaw: rec.save?.hero.yaw ?? 0,
      }))
      deps.registry.monde()?.updateCard(rec.id, { district: this.district, status: 'actif' })
    }

    override onDrop(client: Client): void {
      this.allowReconnection(client, NET.reconnectSeconds)
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
      this.chatLimit.forget(id)
      this.talkLimit.forget(id)
      this.actionLimit.forget(id)
    }

    private avatarOf(client: Client): Avatar | undefined {
      return this.state.avatars.get(this.sessions.playerOf(client) ?? '')
    }
  }
}
