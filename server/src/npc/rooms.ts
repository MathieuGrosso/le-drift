import type { DistrictId } from '../../../src/core/types'
import type { NpcAction, NpcSay, PlayerId, ServerMessages } from '../../../src/shared/protocol'
import { NpcCard, NpcOrder, type MondeState, type QuartierState } from '../state'
import type { NpcSheet, NpcWorld } from './brain'
import { SHEETS } from './sheets'

type NpcPrivate = Pick<ServerMessages, 'npc:say' | 'npc:give' | 'npc:quest'>

/** The slice of a Colyseus room the brains need; `QuartierRoom` passes itself. */
export interface QuartierHandle {
  readonly state: QuartierState
  readonly clients: Iterable<{ auth?: { id?: string } | null; send(type: string, message: unknown): void }>
  broadcast(type: 'npc:say', message: NpcSay): void
}

/**
 * Rooms register here on create and unregister on dispose:
 * `deps.brains.rooms.addMonde(this.state)` in `MondeRoom.onCreate`,
 * `deps.brains.rooms.addQuartier(this)` / `removeQuartier(this)` in `QuartierRoom.onCreate` / `onDispose`.
 */
export class NpcRoomRegistry implements NpcWorld {
  private monde: MondeState | null = null
  private readonly quartiers = new Map<string, QuartierHandle>()

  addMonde(state: MondeState): void {
    this.monde = state
    for (const s of SHEETS) {
      if (!state.npcs.has(s.id)) state.npcs.set(s.id, new NpcCard({ id: s.id, district: s.district, place: s.home, mood: 'content' }))
    }
  }

  /** False when another live room already holds this district: it is never replaced. */
  addQuartier(room: QuartierHandle): boolean {
    const held = this.quartiers.get(room.state.district)
    if (held && held !== room) return false
    this.quartiers.set(room.state.district, room)
    return true
  }

  removeQuartier(room: QuartierHandle): void {
    if (this.quartiers.get(room.state.district) === room) this.quartiers.delete(room.state.district)
  }

  playersIn(district: DistrictId): readonly PlayerId[] {
    return [...(this.quartiers.get(district)?.state.avatars.keys() ?? [])]
  }

  districtOf(player: PlayerId): DistrictId | null {
    for (const [district, room] of this.quartiers) if (room.state.avatars.has(player)) return district as DistrictId
    return null
  }

  nameOf(player: PlayerId): string | null {
    return this.monde?.players.get(player)?.name ?? null
  }

  setCard(npcId: string, patch: Parameters<NpcWorld['setCard']>[1]): void {
    const card = this.monde?.npcs.get(npcId)
    if (!card) return
    if (patch.mood !== undefined) card.mood = patch.mood
    if (patch.place !== undefined) card.place = patch.place
    if (patch.thinking !== undefined) card.thinking = patch.thinking
  }

  apply(sheet: NpcSheet, actions: readonly NpcAction[], untilMs: number): void {
    const room = this.quartiers.get(sheet.district)
    if (!room) return
    const order = (kind: string, fields: { place?: string; emote?: string }) =>
      room.state.orders.set(sheet.id, new NpcOrder({ npcId: sheet.id, kind, until: untilMs, ...fields }))
    for (const a of actions) {
      switch (a.kind) {
        case 'say':
          if (a.to === null) room.broadcast('npc:say', { npcId: sheet.id, text: a.text, to: null })
          else this.sendTo(room, a.to, 'npc:say', { npcId: sheet.id, text: a.text, to: a.to })
          break
        case 'walk':
        case 'sit':
          order(a.kind, { place: a.place })
          this.setCard(sheet.id, { place: a.place })
          break
        case 'emote':
          order('emote', { emote: a.emote })
          break
        case 'give':
          this.sendTo(room, a.to, 'npc:give', { npcId: sheet.id, item: a.item, count: 1 })
          break
        case 'quest':
          this.sendTo(room, a.to, 'npc:quest', { npcId: sheet.id, questId: a.questId })
          break
        case 'idle':
          break
      }
    }
  }

  /** Drops expired orders so clients hand the NPC back to its scripted routine. */
  sweep(nowMs: number): void {
    for (const room of this.quartiers.values()) {
      for (const [id, o] of room.state.orders) if (o.until <= nowMs) room.state.orders.delete(id)
    }
  }

  private sendTo<K extends keyof NpcPrivate>(room: QuartierHandle, player: PlayerId, type: K, message: NpcPrivate[K]): void {
    for (const c of room.clients) if (c.auth?.id === player) c.send(type, message)
  }
}
