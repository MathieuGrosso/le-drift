import type { WorldRecord } from '../persist'

const MINUTE_MS = 60_000

export interface Budget {
  /** Reserves one call; false when the day's tokens or the per-minute rate are spent (NPCs fall back to scripts). */
  take(): boolean
  spend(tokens: number): void
}

export function createBudget(world: WorldRecord, dailyTokens: number, callsPerMinute: number): Budget {
  const calls: number[] = []
  const today = () => new Date().toISOString().slice(0, 10)
  const roll = () => {
    if (world.tokens.day !== today()) world.tokens = { day: today(), used: 0 }
  }
  return {
    take() {
      roll()
      const now = Date.now()
      while (calls.length && now - calls[0]! > MINUTE_MS) calls.shift()
      if (world.tokens.used >= dailyTokens || calls.length >= callsPerMinute) return false
      calls.push(now)
      return true
    },
    spend(tokens) {
      roll()
      world.tokens.used += tokens
    },
  }
}
