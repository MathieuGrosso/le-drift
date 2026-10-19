import { Client, type Room } from '@colyseus/sdk'
import type { DistrictId, NetStatus } from '../core/types'
import {
  PROTOCOL_VERSION, ROOM,
  type ClientMessages, type ClientMessageType, type Identity, type JoinOptions, type MondeStateView, type Profile,
  type QuartierJoinOptions, type QuartierStateView, type ServerMessages, type ServerMessageType,
} from '../shared/protocol'

export type Dispatch = <K extends ServerMessageType>(type: K, payload: ServerMessages[K]) => void

export interface SessionSink {
  status(s: NetStatus): void
  message: Dispatch
  /** The server forgot us (reconnection window expired or it restarted). */
  lost(): void
}

const SERVER_MESSAGES: readonly ServerMessageType[] = ['welcome', 'chat', 'emote', 'npc:say', 'npc:give', 'npc:quest', 'refused']
const MONDE_MESSAGES: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>(['scrub', 'save', 'profile'])

type MondeRoom = Room<unknown, MondeStateView>
type QuartierRoom = Room<unknown, QuartierStateView>

/** Both Colyseus rooms of one player. Every method is fire-and-forget for the frame loop. */
export class Session {
  private readonly client: Client
  private monde: MondeRoom | null = null
  private quartier: QuartierRoom | null = null
  private district: DistrictId | null = null
  private generation = 0
  private readonly leaving = new WeakSet<object>()
  private current: NetStatus = 'solo'

  constructor(endpoint: string, private readonly identity: Identity, private profile: Profile, private readonly sink: SessionSink) {
    this.client = new Client(endpoint)
  }

  get status(): NetStatus {
    return this.current
  }

  get mondeState(): MondeStateView | null {
    return this.monde?.state ?? null
  }

  get quartierState(): QuartierStateView | null {
    return this.quartier?.state ?? null
  }

  async start(district: DistrictId): Promise<boolean> {
    this.setStatus('connecting')
    try {
      const opts: JoinOptions = { protocol: PROTOCOL_VERSION, identity: this.identity, profile: this.profile }
      const monde = await this.client.joinOrCreate<MondeStateView>(ROOM.monde, opts)
      this.monde = monde
      this.wire(monde, () => this.sink.lost())
      await this.enter(district)
      this.setStatus('online')
      return true
    } catch (err) {
      console.warn('[net] le Drift partagé ne répond pas, on reste en solo', err)
      await this.stop()
      return false
    }
  }

  /** Joins the new district before leaving the old one, so nobody pops out at the gangway. */
  async enter(district: DistrictId): Promise<void> {
    if (!this.monde || (this.district === district && this.quartier)) return
    const gen = ++this.generation
    this.district = district
    const opts: QuartierJoinOptions = { protocol: PROTOCOL_VERSION, identity: this.identity, profile: this.profile, district }
    const next = await this.client.joinOrCreate<QuartierStateView>(ROOM.quartier, opts)
    if (gen !== this.generation || !this.monde) {
      this.leave(next)
      return
    }
    const prev = this.quartier
    this.quartier = next
    this.wire(next, () => {
      if (this.quartier !== next) return
      this.quartier = null
      const d = this.district
      this.district = null
      if (d && this.monde) this.enter(d).catch(() => this.sink.lost())
    })
    if (prev) this.leave(prev)
  }

  setProfile(p: Profile): void {
    this.profile = p
    this.send('profile', p)
  }

  send<K extends ClientMessageType>(type: K, payload: ClientMessages[K]): void {
    const room = MONDE_MESSAGES.has(type) ? this.monde : this.quartier
    room?.send(type, payload)
  }

  async stop(): Promise<void> {
    this.generation++
    const rooms = [this.quartier, this.monde]
    this.quartier = null
    this.monde = null
    this.district = null
    for (const r of rooms) if (r) this.leave(r)
    this.setStatus('solo')
  }

  private leave(room: MondeRoom | QuartierRoom): void {
    this.leaving.add(room)
    room.leave(true).catch(() => undefined)
  }

  private wire(room: MondeRoom | QuartierRoom, onLost: () => void): void {
    for (const type of SERVER_MESSAGES) {
      room.onMessage(type, (payload: ServerMessages[typeof type]) => this.sink.message(type, payload))
    }
    room.onDrop(() => this.setStatus('reconnecting'))
    room.onReconnect(() => this.setStatus('online'))
    room.onLeave(() => {
      if (!this.leaving.has(room)) onLost()
    })
  }

  private setStatus(s: NetStatus): void {
    if (s === this.current) return
    this.current = s
    this.sink.status(s)
  }
}
