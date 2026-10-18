import { migrateState } from './state'
import type { EventBus, GameState, SaveStore } from './types'

export const SAVE_KEY = 'le-drift:save:v2'
export const LEGACY_SAVE_KEYS = ['le-drift:save:v1'] as const

export function createSaveStore(getState: () => GameState, bus: EventBus, enabled: boolean): SaveStore {
  return {
    enabled,
    write() {
      if (!enabled) return false
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(getState()))
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
