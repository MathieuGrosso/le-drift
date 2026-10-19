import Anthropic from '@anthropic-ai/sdk'
import { MOODS, NPC_INTENTS, LIMITS } from '../../../src/shared/protocol'
import type { DecideFn, NpcSheet } from './brain'

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'target', 'say', 'mood'],
  properties: {
    intent: { type: 'string', enum: [...NPC_INTENTS] },
    target: { type: ['string', 'null'] },
    say: { type: ['string', 'null'], maxLength: LIMITS.sayMax },
    mood: { type: 'string', enum: [...MOODS] },
  },
} as const


export function createDecide(client: Anthropic, model: string, onUsage: (tokens: number) => void): DecideFn {
  return async (sheet: NpcSheet, context: string, effort) => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: sheet.system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort, format: { type: 'json_schema', schema: DECISION_SCHEMA } },
      messages: [{ role: 'user', content: context }],
    })
    onUsage(res.usage.input_tokens + res.usage.output_tokens + (res.usage.cache_creation_input_tokens ?? 0))
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
