import { z } from 'zod'
import {
  AVATAR_COLORS, EMOTES, LIMITS, PROTOCOL_VERSION, sanitizeText,
  type ClientMessages, type JoinOptions, type QuartierJoinOptions,
} from '../../src/shared/protocol'
import type { DistrictId } from '../../src/core/types'
import { DISTRICTS as DISTRICT_DEFS } from '../../src/core/layout'

const DISTRICTS = DISTRICT_DEFS.map((d) => d.id) as [DistrictId, ...DistrictId[]]
const finite = z.number().finite()
const text = (max: number) => z.string().max(max * 4).transform((s) => sanitizeText(s, max)).pipe(z.string().min(1))
const id = (max: number) => z.string().regex(/^[a-z0-9:_-]+$/).max(max)
const vec3 = z.object({ x: finite, y: finite, z: finite })

const profile = z.object({
  name: text(LIMITS.nameMax).pipe(z.string().min(LIMITS.nameMin)),
  color: z.number().int().refine((c) => (AVATAR_COLORS as readonly number[]).includes(c)),
})

const identity = z.object({ id: z.uuid(), secret: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/) })

export const joinOptions = z.object({ protocol: z.literal(PROTOCOL_VERSION), identity, profile }) satisfies z.ZodType<JoinOptions>
export const quartierJoinOptions = joinOptions.extend({ district: z.enum(DISTRICTS) }) satisfies z.ZodType<QuartierJoinOptions>
export const quartierCreateOptions = quartierJoinOptions.pick({ district: true })

const playerSave = z.object({
  version: z.literal(2),
  act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  quests: z.record(id(48), z.string().max(48)),
  flags: z.record(id(48), z.boolean()),
  chart: z.object({
    sondes: z.array(id(48)).max(64),
    reperes: z.array(id(48)).max(256),
    pins: z.array(z.object({ x: finite, z: finite, icon: id(24) })).max(256),
  }),
  inventory: z.object({ items: z.record(id(48), z.number().int().min(0).max(999)), slots: z.number().int().min(1).max(99) }),
  shallows: z.array(id(48)).max(64),
  trouvailles: z.array(id(48)).max(128),
  hero: z.object({ localPosition: vec3.nullable(), yaw: finite, district: z.enum(DISTRICTS), room: id(48).nullable() }),
})

export const clientMessages = {
  move: z.object({
    p: z.tuple([finite, finite, finite]),
    yaw: finite,
    mode: z.enum(['idle', 'walk', 'swim', 'climb', 'scrub', 'ladder', 'sit', 'lean', 'sleep', 'fall', 'cutscene', 'airlock']),
    outside: z.boolean(),
  }),
  chat: z.object({ text: text(LIMITS.chatMax) }),
  emote: z.object({ emote: z.enum(EMOTES) }),
  sit: z.object({ seatId: id(48).nullable() }),
  talk: z.object({ npcId: id(LIMITS.npcIdMax), text: text(LIMITS.chatMax).nullable() }),
  away: z.object({ away: z.boolean() }),
  scrub: z.object({ windowId: id(LIMITS.windowIdMax), amount: z.number().min(0).max(1) }),
  save: z.object({
    save: playerSave.refine((s) => Buffer.byteLength(JSON.stringify(s)) <= LIMITS.saveBytesMax, 'sauvegarde trop lourde'),
  }),
  profile,
} satisfies { [K in keyof ClientMessages]: z.ZodType<ClientMessages[K]> }
