import { CloseCode, type Client } from '@colyseus/core'
import type { z } from 'zod'
import type { ServerMessages } from '../../../src/shared/protocol'
import { GUARDS } from '../config'

const MINUTE_MS = 60_000

export function refuse(client: Client, reason: ServerMessages['refused']['reason'], detail: string): void {
  const msg: ServerMessages['refused'] = { reason, detail }
  client.send('refused', msg)
}

/** Sliding-window rate limit per key. */
export function createRateLimit(max: number, windowMs: number) {
  const hits = new Map<string, number[]>()
  return {
    allow(key: string): boolean {
      const now = Date.now()
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
      const ok = recent.length < max
      if (ok) recent.push(now)
      hits.set(key, recent)
      return ok
    },
    forget(key: string): void {
      hits.delete(key)
    },
  }
}

/**
 * Colyseus' `validate()` kicks on the first bad payload; a chat line that sanitizes to nothing
 * deserves a `refused`, not a disconnect. Only repeat offenders are dropped.
 */
export function createGuard() {
  const strikes = createRateLimit(GUARDS.invalidStrikesPerMinute, MINUTE_MS)
  return {
    guarded<S extends z.ZodType>(schema: S, handler: (client: Client, msg: z.output<S>) => void) {
      return (client: Client, raw: unknown): void => {
        const parsed = schema.safeParse(raw)
        if (parsed.success) return handler(client, parsed.data)
        if (!strikes.allow(client.sessionId)) return client.leave(CloseCode.WITH_ERROR, 'invalid')
        refuse(client, 'invalid', parsed.error.issues[0]?.message ?? 'message invalide')
      }
    },
    forget: (client: Client) => strikes.forget(client.sessionId),
  }
}
