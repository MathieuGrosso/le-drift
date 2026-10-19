import { createInitialState, migrateState } from './state'
import type { EventBus, GameState, SaveStore } from './types'

export const SAVE_KEY = 'le-drift:save:v2'
export const LEGACY_SAVE_KEYS = ['le-drift:save:v1'] as const

export function createSaveStore(getState: () => GameState, bus: EventBus, enabled: boolean): SaveStore {
  let writeKey = SAVE_KEY
  return {
    enabled,
    useSlot(slot) {
      writeKey = slot ? `${SAVE_KEY}:${slot}` : SAVE_KEY
    },
    write() {
      if (!enabled) return false
      try {
        localStorage.setItem(writeKey, JSON.stringify(getState()))
        bus.emit('save:written', {})
        return true
      } catch {
        return false
      }
    },
    load() {
      if (!enabled) return null
      try {
        for (const k of LEGACY_SAVE_KEYS) localStorage.removeItem(k)
        const raw = localStorage.getItem(SAVE_KEY)
        if (!raw) return null
        return migrateState(JSON.parse(raw), getState().settings.quality)
      } catch {
        return null
      }
    },
    clear() {
      try {
        localStorage.removeItem(SAVE_KEY)
      } catch {
        /* storage unavailable */
      }
    },
  }
}

/** A new game's progress and cabin spawn point, written into `state` in place; settings, clock, drift and the shared window coat stay. */
export function resetToNewGame(state: GameState): void {
  const fresh = createInitialState(state.settings.quality)
  const loose = state as unknown as Record<string, unknown>
  // Progress gameplay keeps outside the declared state (scellées, tubes…) is not a new game's either.
  for (const k of Object.keys(loose)) if (!(k in fresh)) delete loose[k]
  const { act, quests, flags, chart, inventory, shallows, trouvailles, hero } = fresh
  Object.assign(state, { act, quests, flags, chart, inventory, shallows, trouvailles })
  Object.assign(state.hero, { localPosition: hero.localPosition, yaw: hero.yaw, room: hero.room })
}
