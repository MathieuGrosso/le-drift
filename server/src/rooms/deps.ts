import type { Store } from '../persist'
import type { NpcBrains } from '../npc/brain'
import type { PlayerLimits } from './limits'
import type { RoomRegistry } from './registry'

export interface RoomDeps {
  store: Store
  brains: NpcBrains
  registry: RoomRegistry
  limits: PlayerLimits
}
