import type { EventBus, GameEvents } from './types'

type Handler = (p: never) => void

export function createEventBus(): EventBus {
  const handlers = new Map<keyof GameEvents, Set<Handler>>()
  return {
    on(k, fn) {
      let set = handlers.get(k)
      if (!set) {
        set = new Set()
        handlers.set(k, set)
      }
      set.add(fn as Handler)
      return () => {
        set.delete(fn as Handler)
      }
    },
    emit(k, p) {
      const set = handlers.get(k)
      if (!set) return
      for (const fn of [...set]) {
        try {
          ;(fn as (p: unknown) => void)(p)
        } catch (err) {
          console.error(`[bus] ${String(k)}`, err)
        }
      }
    },
  }
}
