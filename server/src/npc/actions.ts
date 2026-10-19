import { z } from 'zod'
import {
  EMOTES, LIMITS, MOODS, NPC_INTENTS, NPC_PLACES, sanitizeText,
  type NpcAction, type PlayerId,
} from '../../../src/shared/protocol'
import type { NpcSheet, NpcThought } from './brain'

const MEMORY_MAX = 280

const thought = z.object({
  intent: z.enum(NPC_INTENTS),
  target: z.string().max(64).nullable(),
  say: z.string().max(LIMITS.sayMax * 2).nullable(),
  mood: z.enum(MOODS),
  remember: z.string().max(MEMORY_MAX * 2).nullable(),
}) satisfies z.ZodType<NpcThought>

const member = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v)

export interface Outcome {
  actions: NpcAction[]
  mood: NpcThought['mood']
  remember: string | null
}

/** The only path from model output to the game: anything outside the whitelist or this NPC's own gifts and quest is dropped. */
export function toActions(raw: unknown, sheet: NpcSheet, talkingTo: PlayerId | null): Outcome | null {
  const parsed = thought.safeParse(raw)
  if (!parsed.success) return null
  const d = parsed.data
  const actions: NpcAction[] = []
  const say = d.say ? sanitizeText(d.say, LIMITS.sayMax) : ''
  if (say) actions.push({ kind: 'say', text: say, to: talkingTo })
  switch (d.intent) {
    case 'walk':
    case 'sit':
      if (member(NPC_PLACES, d.target)) actions.push({ kind: d.intent, place: d.target })
      break
    case 'emote':
      if (member(EMOTES, d.target)) actions.push({ kind: 'emote', emote: d.target })
      break
    case 'give':
      if (talkingTo && member(sheet.gifts, d.target)) actions.push({ kind: 'give', item: d.target, to: talkingTo })
      break
    case 'quest':
      if (talkingTo && sheet.quest && d.target === sheet.quest) actions.push({ kind: 'quest', questId: sheet.quest, to: talkingTo })
      break
    case 'say':
    case 'idle':
      break
  }
  const remember = talkingTo && d.remember ? sanitizeText(d.remember, MEMORY_MAX) : null
  return { actions: actions.length ? actions : [{ kind: 'idle' }], mood: d.mood, remember: remember || null }
}

export function scriptedLine(sheet: NpcSheet, to: PlayerId | null, rng: () => number = Math.random): NpcAction[] {
  const line = sheet.scripted[Math.floor(rng() * sheet.scripted.length)]
  return line ? [{ kind: 'say', text: line, to }] : []
}
