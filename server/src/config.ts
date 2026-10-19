import { DEFAULT_PORT } from '../../src/shared/protocol'

function int(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

export const CONFIG = {
  port: int('PORT', DEFAULT_PORT),
  dataDir: process.env.DRIFT_DATA_DIR ?? new URL('../data/', import.meta.url).pathname,
  npcModel: process.env.NPC_MODEL ?? 'claude-opus-5-5',
  npcDailyTokens: int('NPC_DAILY_TOKENS', 200_000),
  npcTickMinMs: int('NPC_TICK_MIN_MS', 120_000),
  npcTickMaxMs: int('NPC_TICK_MAX_MS', 300_000),
  npcCallsPerMinute: int('NPC_CALLS_PER_MINUTE', 6),
  patchRateMs: int('PATCH_RATE_MS', 80),
} as const
