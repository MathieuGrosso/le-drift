import type { Store } from '../persist'
import type { NpcBrains } from '../npc/brain'

export interface RoomDeps {
  store: Store
  brains: NpcBrains
}
