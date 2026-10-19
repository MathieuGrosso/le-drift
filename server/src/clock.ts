import { TIME } from '../../src/core/tuning'
import { sharedGameHours } from '../../src/shared/protocol'

export const REAL_MS_PER_GAME_HOUR = TIME.realSecondsPerGameHour * 1000

export function gameHoursAt(epochMs: number, nowMs = Date.now()): number {
  return sharedGameHours(nowMs, epochMs, TIME.startHour, REAL_MS_PER_GAME_HOUR)
}
