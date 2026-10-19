import { z } from 'zod'
import {
  EMOTES, LIMITS, MOODS, NPC_GIFTS, NPC_INTENTS, NPC_PLACES, SIDE_QUESTS, sanitizeText,
  type NpcAction, type NpcDecision, type PlayerId,
} from '../../../src/shared/protocol'

const decision = z.object({
  intent: z.enum(NPC_INTENTS),
  target: z.string().max(64).nullable(),
  say: z.string().max(LIMITS.sayMax * 2).nullable(),
  mood: z.enum(MOODS),
}) satisfies z.ZodType<NpcDecision>

const member = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v)

/** The only path from model output to the game: anything outside the whitelist becomes 'idle'. */
export function toActions(raw: unknown, talkingTo: PlayerId | null): { actions: NpcAction[]; mood: NpcDecision['mood'] } | null {
  const parsed = decision.safeParse(raw)
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
      if (talkingTo && member(NPC_GIFTS, d.target)) actions.push({ kind: 'give', item: d.target, to: talkingTo })
      break
    case 'quest':
      if (talkingTo && member(SIDE_QUESTS, d.target)) actions.push({ kind: 'quest', questId: d.target, to: talkingTo })
      break
    case 'say':
    case 'idle':
      break
  }
  return { actions: actions.length ? actions : [{ kind: 'idle' }], mood: d.mood }
}
