import { DEFAULT_PORT } from '../../src/shared/protocol'

function int(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

export const CONFIG = {
  port: int('PORT', DEFAULT_PORT),
  dataDir: process.env.DRIFT_DATA_DIR ?? new URL('../data/', import.meta.url).pathname,
  flushMs: int('FLUSH_MS', 10_000),
  npcScripted: process.env.NPC_BRAINS === 'scripted',
  npcModel: process.env.NPC_MODEL ?? 'claude-opus-5-5',
  npcDailyTokens: int('NPC_DAILY_TOKENS', 200_000),
  npcTickMinMs: int('NPC_TICK_MIN_MS', 120_000),
  npcTickMaxMs: int('NPC_TICK_MAX_MS', 300_000),
  npcCallsPerMinute: int('NPC_CALLS_PER_MINUTE', 6),
} as const

/** Server-side guards; not env-tunable on purpose. */
export const GUARDS = {
  chatWindowMs: 10_000,
  invalidStrikesPerMinute: 20,
  // Fastest legit traversal is a zip line or a tube slide; anything above is a teleport.
  moveSpeedMax: 14,
  teleportCooldownMs: 3_000,
  moveMarginM: 25,
  windowsMax: 12_000,
  actionsPerWindow: 10,
  actionWindowMs: 10_000,
  savesPerWindow: 5,
  profilesPerMinute: 6,
  newWindowsPerMinute: 30,
} as const
