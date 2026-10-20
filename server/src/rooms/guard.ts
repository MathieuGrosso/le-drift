import { CloseCode, ErrorCode, ServerError, type Client } from '@colyseus/core'
import type { z } from 'zod'
import type { ServerMessages } from '../../../src/shared/protocol'
import { GUARDS } from '../config'
import { createRateLimit } from '../rate'

const MINUTE_MS = 60_000

/** An expected refusal of a join or a room creation: one log line, and Colyseus prints no stack for a ServerError. */
export function rejectJoin(room: string, detail: string, code: number = ErrorCode.MATCHMAKE_UNHANDLED): ServerError {
  console.warn(`${room} : refusé (${detail})`)
  return new ServerError(code, detail)
}

/** Parses join or create options, refusing in one line instead of a ZodError dump. */
export function parseJoin<S extends z.ZodType>(room: string, schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  throw rejectJoin(room, issue ? `${issue.path.join('.') || 'options'} : ${issue.message}` : 'options invalides', ErrorCode.MATCHMAKE_INVALID_CRITERIA)
}

export function refuse(client: Client, reason: ServerMessages['refused']['reason'], detail: string): void {
  const msg: ServerMessages['refused'] = { reason, detail }
  client.send('refused', msg)
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
