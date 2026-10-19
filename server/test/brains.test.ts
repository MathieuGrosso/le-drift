import { strict as assert } from 'node:assert'
import { afterEach, mock, test } from 'node:test'
import type Anthropic from '@anthropic-ai/sdk'
import type { NpcSay } from '../../src/shared/protocol'
import { createBrains } from '../src/npc'
import type { NpcBrains } from '../src/npc/brain'
import { CONFIG } from '../src/config'
import { MondeState, QuartierState } from '../src/state'
import { avatar, card, memoryStore } from './fakes'

const live: NpcBrains[] = []
afterEach(() => {
  live.splice(0).forEach((b) => b.dispose())
  mock.timers.reset()
})

function fakeClient(requests: Record<string, unknown>[]) {
  const reply = { intent: 'say', target: null, say: 'Une soupe ?', mood: 'content', remember: null }
  const create = async (body: Record<string, unknown>) => {
    requests.push(body)
    return {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(reply) }],
      usage: { input_tokens: 400, output_tokens: 100, cache_creation_input_tokens: 0 },
    }
  }
  return () => ({ beta: { messages: { create } } }) as unknown as Anthropic
}

function seat(brains: NpcBrains) {
  const said: NpcSay[] = []
  const monde = new MondeState()
  const quartier = new QuartierState({ district: 'ecluse' })
  brains.rooms.addMonde(monde)
  brains.rooms.addQuartier({ state: quartier, clients: [{ auth: { id: 'a' }, send: (_t: string, m: unknown) => void said.push(m as NpcSay) }], broadcast: () => undefined })
  monde.players.set('a', card('a', 'Ilo'))
  quartier.avatars.set('a', avatar('a', 'Ilo'))
  return said
}

test('without credentials the server boots scripted brains and never builds a client', async () => {
  let built = 0
  const brains = await createBrains(memoryStore(), { credentials: async () => false, client: () => (built++, {} as Anthropic) })
  live.push(brains)
  assert.equal(brains.enabled, false)
  assert.equal(built, 0)
  assert.deepEqual(await brains.think('cuistot', { kind: 'talk', player: 'a', text: 'Bonjour' }), [])
})

test('once the daily token budget is spent, an NPC answers with a scripted line instead of calling Claude', async () => {
  const store = memoryStore()
  store.world().tokens = { day: new Date().toISOString().slice(0, 10), used: CONFIG.npcDailyTokens - 1 }
  const requests: Record<string, unknown>[] = []
  const brains = await createBrains(store, { credentials: async () => true, client: fakeClient(requests) })
  live.push(brains)
  const said = seat(brains)
  mock.timers.enable({ apis: ['Date'], now: Date.now() })
  await brains.think('cuistot', { kind: 'talk', player: 'a', text: 'Bonjour' })
  assert.equal(requests.length, 1)
  assert.equal(requests[0]!.model, CONFIG.npcModel)
  assert.equal(requests[0]!.fallbacks, 'default')
  assert.match(JSON.stringify(requests[0]!.output_config), /"type":"json_schema"/)
  assert.match(JSON.stringify(requests[0]!.system), /"cache_control":\{"type":"ephemeral"\}/)
  assert.equal(said[0]!.text, 'Une soupe ?')
  assert.ok(store.world().tokens.used >= CONFIG.npcDailyTokens)
  mock.timers.tick(60_000)
  await brains.think('cuistot', { kind: 'talk', player: 'a', text: 'Encore ?' })
  assert.equal(requests.length, 1)
  assert.equal(said.length, 2)
  assert.notEqual(said[1]!.text, 'Une soupe ?')
})
