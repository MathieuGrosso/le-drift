import { LIMITS } from '../../../src/shared/protocol'
import { GUARDS } from '../config'
import { createRateLimit } from '../rate'

const MINUTE_MS = 60_000

/** Per-player limits shared by every room, so leaving and rejoining (or changing district) does not reset them. */
export function createPlayerLimits() {
  return {
    chat: createRateLimit(LIMITS.chatPerTenSeconds, GUARDS.chatWindowMs),
    talk: createRateLimit(LIMITS.chatPerTenSeconds, GUARDS.chatWindowMs),
    action: createRateLimit(GUARDS.actionsPerWindow, GUARDS.actionWindowMs),
    save: createRateLimit(GUARDS.savesPerWindow, GUARDS.actionWindowMs),
    profile: createRateLimit(GUARDS.profilesPerMinute, MINUTE_MS),
    // Unknown window ids are shared state capped at `windowsMax`: one player must not fill the cap.
    newWindow: createRateLimit(GUARDS.newWindowsPerMinute, MINUTE_MS),
  }
}

export type PlayerLimits = ReturnType<typeof createPlayerLimits>
