import Anthropic from '@anthropic-ai/sdk'
import { defaultCredentials } from '@anthropic-ai/sdk/lib/credentials/credential-chain'
import type { NpcAction, PlayerId } from '../../../src/shared/protocol'
import { gameHoursAt } from '../clock'
import { CONFIG } from '../config'
import { createRateLimit } from '../rate'
import type { Store } from '../persist'
import { scriptedLine, toActions } from './actions'
import type { DecideFn, NpcBrains, NpcSheet, NpcTrigger } from './brain'
import { createBudget } from './budget'
import { createDecide } from './decide'
import { createMemories } from './memory'
import { situation, type Moment } from './prompt'
import { NpcRoomRegistry } from './rooms'
import { SHEETS, SHEET_BY_ID } from './sheets'
import { NPC_TUNING } from './tuning'

/** Scripted mode: no orders are issued and clients keep their local routines and CHATTER lines. */
export function createScriptedBrains(): NpcBrains {
  const rooms = new NpcRoomRegistry()
  return { enabled: false, rooms, think: async () => [], observe: () => undefined, dispose: () => undefined }
}

async function hasCredentials(): Promise<boolean> {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true
  try {
    return (await defaultCredentials({ baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com', fetch })) !== null
  } catch {
    return false
  }
}

/** Claude brains when credentials resolve (env key or an `ant auth login` profile), scripted otherwise. */
export async function createBrains(store: Store): Promise<NpcBrains> {
  if (!(await hasCredentials())) return createScriptedBrains()
  const budget = createBudget(store.world(), CONFIG.npcDailyTokens, CONFIG.npcCallsPerMinute)
  const decide = createDecide(new Anthropic(), CONFIG.npcModel, (tokens) => budget.spend(tokens))
  return createClaudeBrains(store, decide, () => budget.take())
}

const jitter = () => CONFIG.npcTickMinMs + Math.random() * (CONFIG.npcTickMaxMs - CONFIG.npcTickMinMs)

export function createClaudeBrains(store: Store, decide: DecideFn, take: () => boolean): NpcBrains {
  const rooms = new NpcRoomRegistry()
  const memories = createMemories(store)
  const nextTick = new Map(SHEETS.map((s) => [s.id, Date.now() + jitter()]))
  const thinking = new Set<string>()
  const lastTalk = new Map<PlayerId, number>()
  const observed = createRateLimit(NPC_TUNING.observedPerPlayer, NPC_TUNING.observedWindowMs)
  let live = true

  const present = (sheet: NpcSheet, except: PlayerId | null) =>
    rooms.playersIn(sheet.district).filter((p) => p !== except).slice(0, NPC_TUNING.playersInPrompt)
      .map((p) => rooms.nameOf(p)).filter((n): n is string => n !== null)

  const call = async (sheet: NpcSheet, moment: Moment, talkingTo: PlayerId | null) => {
    const context = situation(sheet, {
      hours: gameHoursAt(store.world().epochMs), present: present(sheet, talkingTo), recent: memories.recent(sheet.id), moment,
    })
    thinking.add(sheet.id)
    rooms.setCard(sheet.id, { thinking: true })
    try {
      return toActions(await decide(sheet, context, moment.kind === 'talk' ? 'medium' : 'low'), sheet, talkingTo)
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        live = false
        console.warn('PNJ : identifiants Claude refusés, retour aux répliques écrites.')
      } else {
        console.warn(`PNJ ${sheet.id} : ${err instanceof Error ? err.message : String(err)}`)
      }
      return null
    } finally {
      thinking.delete(sheet.id)
      rooms.setCard(sheet.id, { thinking: false })
    }
  }

  const act = (sheet: NpcSheet, actions: NpcAction[]) => {
    rooms.apply(sheet, actions, Date.now() + NPC_TUNING.orderMs)
    // A reply to one player stays out of the shared memory: it can echo what they said in private.
    for (const a of actions) if (a.kind === 'say' && a.to === null) memories.note(sheet.id, { kind: 'said', text: a.text })
    return actions
  }

  const talk = async (sheet: NpcSheet, player: PlayerId, text: string | null): Promise<NpcAction[]> => {
    const now = Date.now()
    if (rooms.districtOf(player) !== sheet.district || now - (lastTalk.get(player) ?? 0) < NPC_TUNING.talkCooldownMs) return []
    lastTalk.set(player, now)
    const name = rooms.nameOf(player) ?? 'quelqu’un'
    const thought = live && !thinking.has(sheet.id) && take()
      ? call(sheet, { kind: 'talk', name, text, memory: memories.about(sheet.id, player) }, player)
      : null
    memories.note(sheet.id, { kind: 'visit', who: name })
    const out = await thought
    if (!out) return act(sheet, scriptedLine(sheet, player))
    if (out.remember) memories.rewrite(sheet.id, player, out.remember)
    rooms.setCard(sheet.id, { mood: out.mood })
    return act(sheet, out.actions)
  }

  const tick = async (sheet: NpcSheet): Promise<NpcAction[]> => {
    if (!live || thinking.has(sheet.id) || rooms.playersIn(sheet.district).length === 0 || !take()) return []
    const out = await call(sheet, { kind: 'tick' }, null)
    if (!out) return []
    rooms.setCard(sheet.id, { mood: out.mood })
    return act(sheet, out.actions)
  }

  const scheduler = setInterval(() => {
    const now = Date.now()
    rooms.sweep(now)
    for (const sheet of SHEETS) {
      if (now < nextTick.get(sheet.id)!) continue
      nextTick.set(sheet.id, now + jitter())
      void tick(sheet)
    }
  }, NPC_TUNING.schedulerMs)

  return {
    get enabled() {
      return live
    },
    rooms,
    think(npcId: string, trigger: NpcTrigger) {
      const sheet = SHEET_BY_ID.get(npcId)
      if (!sheet) return Promise.resolve([])
      return trigger.kind === 'talk' ? talk(sheet, trigger.player, trigger.text) : tick(sheet)
    },
    observe(district, said) {
      if (!observed.allow(`${district}:${said.player}`)) return
      for (const s of SHEETS) if (s.district === district) memories.note(s.id, { kind: 'chat', who: said.name, text: said.text })
    },
    dispose: () => clearInterval(scheduler),
  }
}
