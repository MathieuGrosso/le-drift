import type { WorldRecord } from '../persist'

export interface Budget {
  /** False when the day's tokens or the per-minute call rate are spent: NPCs fall back to scripts. */
  allow(): boolean
  spend(tokens: number): void
}

export function createBudget(world: WorldRecord, dailyTokens: number, callsPerMinute: number): Budget {
  const calls: number[] = []
  const today = () => new Date().toISOString().slice(0, 10)
  const roll = () => {
    if (world.tokens.day !== today()) world.tokens = { day: today(), used: 0 }
  }
  return {
    allow() {
      roll()
      const now = Date.now()
      while (calls.length && now - calls[0]! > 60_000) calls.shift()
      return world.tokens.used < dailyTokens && calls.length < callsPerMinute
    },
    spend(tokens) {
      roll()
      calls.push(Date.now())
      world.tokens.used += tokens
    },
  }
}
