import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createInitialState } from '../../src/core/state'
import type { GameContext, GameState } from '../../src/core/types'
import { adoptWelcome, RemoteSave, toPlayerSave } from '../../src/net/save'
import type { PlayerSave } from '../../src/shared/protocol'

function soloTab() {
  const state: GameState = createInitialState()
  Object.assign(state, {
    act: 2,
    quests: { 'a1-reveil': 'done', 'a2-domes': 'domes' },
    flags: { intro: true, pluie: true },
    inventory: { items: { frottoir: 1, longe: 1, poulie: 1, perle: 4 }, slots: 20 },
    trouvailles: ['coquille'],
    shallows: ['haut-fond-1'],
    scellees: ['scellee-nord'],
  })
  state.chart.sondes.push('sonde-1')
  state.hero.room = 'refectoire' as GameState['hero']['room']
  const slots: (string | null)[] = []
  const writes: string[] = []
  const acts: number[] = []
  const sent: PlayerSave[] = []
  const ctx = {
    state,
    save: {
      enabled: true,
      useSlot: (slot: string | null) => void slots.push(slot),
      write: () => (writes.push(JSON.stringify(state)), true),
      load: () => null,
      clear: () => undefined,
    },
    services: { gameplay: { setAct: (a: number) => void acts.push(a) } },
    bus: { emit: () => undefined, on: () => () => undefined },
  } as unknown as GameContext
  const remote = new RemoteSave(state, (m) => void sent.push(m.save))
  return { ctx, state, remote, slots, writes, acts, sent }
}

test('a first join starts a new game and uploads it, not the solo progress of the tab', () => {
  const tab = soloTab()
  const isNew = adoptWelcome(tab.ctx, { you: 'p1', save: null, brains: false }, tab.remote, true)

  assert.equal(isNew, true)
  assert.deepEqual(tab.slots, ['online:p1'])
  assert.equal(tab.writes.length, 1)
  assert.deepEqual(tab.acts, [1])
  assert.equal(tab.sent.length, 1)
  assert.deepEqual(tab.sent[0], toPlayerSave(createInitialState()))
  assert.equal('scellees' in tab.state, false)
})

test('a returning player gets their server save and uploads nothing on join', () => {
  const tab = soloTab()
  const server = { ...toPlayerSave(createInitialState()), act: 1 as const, quests: { 'a1-reveil': 'sas' } }
  const isNew = adoptWelcome(tab.ctx, { you: 'p2', save: server, brains: false }, tab.remote, true)

  assert.equal(isNew, false)
  assert.deepEqual(tab.state.quests, { 'a1-reveil': 'sas' })
  assert.equal(tab.sent.length, 0)
  assert.equal(tab.writes.length, 0)
})
