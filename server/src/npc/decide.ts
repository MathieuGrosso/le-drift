import Anthropic from '@anthropic-ai/sdk'
import { MOODS, NPC_INTENTS } from '../../../src/shared/protocol'
import type { DecideFn } from './brain'
import { WORLD } from './sheets'

const MAX_TOKENS = 2048
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const

const THOUGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'target', 'say', 'mood', 'remember'],
  properties: {
    intent: { type: 'string', enum: [...NPC_INTENTS] },
    target: nullableString,
    say: nullableString,
    mood: { type: 'string', enum: [...MOODS] },
    remember: nullableString,
  },
} as const

/** One call per thought. Throws on transport/API errors; returns null on a refusal (after the fallback chain) or a non-JSON reply. */
export function createDecide(client: Anthropic, model: string, onUsage: (tokens: number) => void): DecideFn {
  return async (sheet, context, effort) => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: WORLD, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: sheet.persona, cache_control: { type: 'ephemeral' } },
      ],
      output_config: { effort, format: { type: 'json_schema', schema: THOUGHT_SCHEMA } },
      messages: [{ role: 'user', content: context }],
    })
    const u = res.usage
    onUsage(u.input_tokens + u.output_tokens + (u.cache_creation_input_tokens ?? 0))
    if (res.stop_reason === 'refusal') return null
    const text = res.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return null
    try {
      return JSON.parse(text.text) as unknown
    } catch {
      return null
    }
  }
}
