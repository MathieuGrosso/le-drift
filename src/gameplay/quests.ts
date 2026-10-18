import type { Act, Vec3 } from '../core/types'
import type { Candidate, Gp, Line, Quests } from './context'
import { PROUE_PANES } from './world/proue'
import { CHART_ROOMS } from './world/sites'
import { ACT_CARDS, DIALOGUES, QUESTS, SIDE_QUESTS, TIPS, UI } from './text/fr'
import { northMornings } from './weather'
import { quarterPoint } from '../core/layout'

const ACT1 = ['a1-reveil', 'a1-sortie', 'a1-grande-vitre', 'a1-chose', 'a1-petit-dejeuner', 'a1-rebord', 'a1-dome', 'a1-grand-pere', 'a1-poulie'] as const
const ORDER = [...ACT1, 'a2-domes', 'a2-lest', 'a3-matin', 'a3-pluie', 'a3-dome-proue', 'a3-ligne'] as const
const isBigWindow = (id: string) => id === 'grande-vitre' || /grande/.test(id)
const isGrandpaWindow = (id: string) => /grand-?pere/.test(id)

type LooseBus = { on(k: string, fn: (p: Record<string, unknown>) => void): () => void }

export function createQuests(gp: Gp): Quests {
  const ctx = gp.ctx
  const st = () => ctx.state
  const loose = ctx.bus as unknown as LooseBus
  let running = false
  let started = false

  const say = (lines: readonly Line[], npc?: string) => gp.dialogue.play(lines, npc)
  const settle = async (p: Promise<unknown> | undefined, seconds: number): Promise<void> => {
    if (!p) return
    await Promise.race([p.then(() => undefined, () => undefined), gp.cine.wait(seconds)])
  }
  const scene = async (fn: () => Promise<void>) => {
    if (running) return
    running = true
    gp.lock.count++
    try {
      await fn()
    } catch (err) {
      console.error('[gameplay] quête', err)
    } finally {
      gp.lock.count--
      running = false
    }
  }

  const set = (questId: string, step: string) => {
    const q = st().quests
    if (q[questId] === step) return
    if (q[questId] === 'done' && step !== 'done') return
    q[questId] = step
    ctx.bus.emit('quest:step', { questId, step })
    if (step === 'done') {
      ctx.bus.emit('quest:completed', { questId })
      return
    }
    const text = QUESTS[questId]?.steps[step] ?? SIDE_QUESTS[questId]?.steps[step]
    if (text) gp.toast(`${UI.nouvelleTache} : ${text}`)
  }
  const step = (id: string) => st().quests[id]
  const mapDomes = () => gp.domes.count(true)

  const ripples = async (count: number, around: Vec3, spread: number, every: number) => {
    const render = ctx.services.render
    for (let i = 0; i < count; i++) {
      const x = around.x + (Math.random() - 0.5) * spread
      const z = around.z + (Math.random() - 0.5) * spread
      render?.addRipple(x, z, 0.6 + Math.random() * 0.4)
      ctx.bus.emit('ceiling:ripple', { x, z, strength: 0.8 })
      await gp.cine.wait(every)
    }
  }

  const bigWindowPos = (): Vec3 => {
    const w = ctx.services.drift?.nearestWindow(gp.heroPos(), 40)
    if (w && isBigWindow(w.id)) return w.position
    return st().drift.position ? ctx.services.drift?.toWorld(quarterPoint({ x: 18, y: 2.6, z: 72.4 })) ?? st().drift.position : st().hero.position
  }

  const afterBigWindow = () =>
    scene(async () => {
      set('a1-grande-vitre', 'done')
      ctx.services.fauna?.spawnScripted('tortue-premiere')
      await say(DIALOGUES.grandeVitre)
      set('a1-chose', 'regarder')
      gp.cue('wonder')
      const target = bigWindowPos()
      const above = { x: target.x + 10, y: target.y + 12, z: target.z + 25 }
      const fauna = ctx.services.fauna
      if (fauna) await settle(fauna.choseDive(above, false), 16)
      else await ripples(6, above, 6, 0.6)
      await say(DIALOGUES.chose)
      set('a1-chose', 'done')
      set('a1-petit-dejeuner', st().hero.medium === 'air' ? 'cuisine' : 'rentrer')
      gp.cue('drift')
    })

  const breakfastTutorial = () =>
    scene(async () => {
      await say(DIALOGUES.cuistotTuto, 'cuistot')
      while (gp.inv.count('poisson') < 2) gp.inv.give('poisson', 1, true)
      if (!gp.inv.has('mie-du-cuistot')) gp.inv.give('mie-du-cuistot', 1, true)
      set('a1-petit-dejeuner', 'cuisiner')
    }).then(() => {
      if (step('a1-petit-dejeuner') === 'cuisiner') void gp.menus.cook({ tutorial: true })
    })

  const finishBreakfast = () =>
    scene(async () => {
      await gp.cine.wait(1.2)
      gp.menus.close()
      await say(DIALOGUES.cuistotApres, 'cuistot')
      if (ctx.services.drift?.seat('siege-ilo')) ctx.services.hero?.sit('siege-ilo')
      await settle(ctx.services.drift?.playScene('petit-dejeuner'), 25)
      ctx.services.hero?.stand()
      set('a1-petit-dejeuner', 'done')
      set('a1-rebord', 'rebord')
    })

  const playRebord = () =>
    scene(async () => {
      set('a1-rebord', 'jeu')
      void ctx.services.drift?.playScene('rebord').catch(() => undefined)
      await say(DIALOGUES.rebordAvant, 'mila')
      await gp.cine.clapping()
      await say(DIALOGUES.rebordApres, 'mila')
      set('a1-rebord', 'done')
      set('a1-dome', 'monter')
      gp.hud.tip(TIPS.sac(ctx.input.keyLabel('inventory')))
    })

  const poulieScene = () =>
    scene(async () => {
      await say(DIALOGUES.poulie, 'mme-rouille')
      gp.inv.give('poulie')
      set('a1-poulie', 'tyrolienne')
    })

  const carteScene = () =>
    scene(async () => {
      await say(DIALOGUES.carte, 'grand-pere')
      set('a1-poulie', 'done')
      gp.hud.tip(TIPS.carte(ctx.input.keyLabel('map')), 7)
      await gp.cine.wait(0.8)
      api.setAct(2, true)
    })

  const matinScene = () =>
    scene(async () => {
      gp.cue('wonder')
      const fauna = ctx.services.fauna
      const drift = ctx.services.drift
      const target = bigWindowPos()
      const dive = fauna?.choseDive({ x: target.x, y: target.y + 4, z: target.z + 8 }, true)
      const room = drift?.playScene('chose-vitre')
      await say(DIALOGUES.matin3)
      await settle(dive, 6)
      await settle(room, 6)
      st().flags['pluie'] = true
      gp.weather.set({ rain: 1 })
      gp.cue('rain')
      void ripples(40, target, 60, 0.12)
      await say(DIALOGUES.pluieRonds)
      set('a3-matin', 'done')
      set('a3-pluie', 'salle')
    })

  const pluieScene = () =>
    scene(async () => {
      const play = ctx.services.drift?.playScene('grand-pere-pluie')
      await say(DIALOGUES.pluie, 'grand-pere')
      await settle(play, 8)
      gp.inv.give('stylo')
      set('a3-pluie', 'done')
      set('a3-dome-proue', 'monter')
    })

  const grandpaGeneral = () =>
    scene(async () => {
      if (gp.inv.count('nacre') >= 4) {
        await say(DIALOGUES.nacres, 'grand-pere')
        gp.inv.take('nacre', 4)
        gp.inv.addNacreUpgrade()
        gp.endurance.refill()
        gp.toast(UI.enduranceAllongee)
        gp.sfx('breath-full')
        return
      }
      if (st().act === 2 && step('a2-domes') === 'domes') {
        await say(DIALOGUES.domesRestants(Math.max(0, 3 - mapDomes())), 'grand-pere')
        return
      }
      await say(DIALOGUES.grandPere[st().act], 'grand-pere')
    })

  const chartTable = () => {
    if (step('a1-poulie') === 'carte' || step('a1-poulie') === 'tyrolienne') void carteScene()
    else if (step('a3-pluie') === 'salle') void pluieScene()
    else gp.chart.open('mer')
  }

  const greet = (pool: readonly (readonly Line[])[], key: string) => {
    const n = (st().flags[key] ? 1 : 0) + st().time.day + Math.floor(st().time.hours)
    st().flags[key] = !st().flags[key]
    return pool[n % pool.length]!
  }

  const requestTalk = (npc: string, id: string, ask: readonly Line[], has: () => boolean, pay: () => void, thanks: readonly Line[], reward: () => void, fallback: readonly (readonly Line[])[]) => {
    const req = gp.progress().requests
    if (req[id] === 'done') return void scene(async () => say(greet(fallback, `g-${npc}`), npc))
    if (!req[id]) {
      req[id] = 'ask'
      return void scene(async () => {
        await say(ask, npc)
        set(id, Object.keys(SIDE_QUESTS[id]!.steps)[0]!)
      })
    }
    if (has()) {
      return void scene(async () => {
        pay()
        await say(thanks, npc)
        reward()
        req[id] = 'done'
        set(id, 'done')
      })
    }
    void scene(async () => say(ask, npc))
  }

  const lestScene = () =>
    scene(async () => {
      await say(DIALOGUES.bastienLest.slice(0, 3), 'bastien')
      gp.sfx('ballast')
      gp.sfx('groan')
      st().flags['lest-vide'] = true
      gp.emit('drift:altitude', { y: 80 })
      await say(DIALOGUES.bastienLest.slice(3), 'bastien')
      set('a2-domes', 'done')
      set('a2-lest', 'dormir')
    })

  ctx.bus.on('cell:entered', ({ cellId }) => {
    const r = cellId
    if (r === 'sas' && step('a1-reveil') === 'sas') set('a1-reveil', 'tableau')
    if (r === 'cuisine' && step('a1-petit-dejeuner') === 'cuisine') void breakfastTutorial()
    if (r === 'rebord' && step('a1-rebord') === 'rebord') void playRebord()
    if (r === 'refectoire' && step('a3-matin') === 'refectoire') void matinScene()
    if (CHART_ROOMS.includes(r) && step('a1-poulie') === 'tyrolienne') set('a1-poulie', 'carte')
    if (r === 'dome-ecluse' && step('a1-dome') === 'monter') set('a1-dome', 'lunette')
  })
  ctx.bus.on('district:entered', ({ district }) => {
    if (district === 'nef' && step('a1-poulie') === 'tyrolienne') {
      set('a1-poulie', 'carte')
      void scene(async () => say(DIALOGUES.nefArrivee))
    }
  })
  ctx.bus.on('hero:medium', ({ medium }) => {
    if (medium === 'water' && step('a1-reveil') === 'sortir') {
      set('a1-reveil', 'done')
      set('a1-sortie', 'coque')
      gp.hud.tip(TIPS.nage(ctx.input.keyLabel('up'), ctx.input.keyLabel('down')), 8)
      void scene(async () => say(DIALOGUES.premiereSortie))
    }
    if (medium === 'air' && step('a1-petit-dejeuner') === 'rentrer') set('a1-petit-dejeuner', 'cuisine')
    if (medium === 'air' && step('a3-dome-proue') === 'rentrer') {
      void scene(async () => {
        await say(DIALOGUES.domeProuePropre)
        set('a3-dome-proue', 'done')
        set('a3-ligne', 'lunette')
        await say(DIALOGUES.ligne, 'grand-pere')
      })
    }
  })
  ctx.bus.on('scrub:done', ({ windowId }) => {
    if (step('a1-grande-vitre') === 'frotter' && isBigWindow(windowId)) void afterBigWindow()
    else if (step('a1-grand-pere') === 'vitre' && isGrandpaWindow(windowId)) {
      void scene(async () => {
        await say(DIALOGUES.vitreGrandPere)
        set('a1-grand-pere', 'done')
        set('a1-poulie', 'rouille')
      })
    }
  })
  ctx.bus.on('cook:done', () => {
    if (step('a1-petit-dejeuner') === 'cuisiner') void finishBreakfast()
  })
  loose.on('dome:activated', (p) => {
    const id = String(p['domeId'] ?? '')
    if (id === 'dome-ecluse' && step('a1-dome') !== 'done') {
      void scene(async () => {
        set('a1-dome', 'done')
        await say(DIALOGUES.domeEcluse)
        set('a1-grand-pere', 'vitre')
      })
      return
    }
    if (st().act === 2 && step('a2-domes') === 'domes') {
      const n = mapDomes()
      if (n >= 3) set('a2-domes', 'bastien')
      else gp.toast(`${QUESTS['a2-domes']!.titre} : ${n}/3`)
    }
  })
  loose.on('zip:end', () => {
    if (step('a1-poulie') === 'tyrolienne') {
      set('a1-poulie', 'carte')
      void scene(async () => say(DIALOGUES.nefArrivee))
    }
  })
  ctx.bus.on('sleep:done', () => {
    if (step('a2-lest') !== 'dormir') return
    const k = northMornings(st().flags)
    if (k < 2) {
      st().flags[`nord-matin-${k + 1}`] = true
      gp.weather.morning()
      void scene(async () => say(DIALOGUES.matinsNord[k]!))
      return
    }
    st().flags['nord-matin-3'] = true
    set('a2-lest', 'done')
    api.setAct(3, true)
  })

  const api: Quests = {
    set,
    step,
    start() {
      if (started) return
      started = true
      if (Object.keys(st().quests).length > 0) return
      if (st().act === 1) set('a1-reveil', st().hero.room === 'sas' ? 'tableau' : 'sas')
      else api.setAct(st().act)
    },
    objective() {
      for (const id of ORDER) {
        const s = step(id)
        if (!s || s === 'done') continue
        let t = QUESTS[id]?.steps[s]
        if (!t) continue
        if (id === 'a2-domes' && s === 'domes') t += ` (${mapDomes()}/3)`
        if (id === 'a3-dome-proue' && s === 'sortie') t += ` (${Math.min(gp.proue.scrubbed(), PROUE_PANES)}/${PROUE_PANES})`
        return t
      }
      for (const [id, q] of Object.entries(SIDE_QUESTS)) {
        const s = step(id)
        if (s && s !== 'done') return q.steps[s] ?? null
      }
      return null
    },
    talk(npcId) {
      if (running) return
      switch (npcId) {
        case 'mme-rouille':
          if (step('a1-reveil') === 'tableau') {
            void scene(async () => {
              await say(DIALOGUES.tableauA1, 'mme-rouille')
              set('a1-reveil', 'sortir')
              gp.hud.tip(TIPS.sas(ctx.input.keyLabel('interact')), 6)
            })
          } else if (step('a1-poulie') === 'rouille') void poulieScene()
          else void scene(async () => say(greet(DIALOGUES.rouille, 'g-rouille'), 'mme-rouille')).then(() => gp.menus.board())
          return
        case 'cuistot': {
          const s = step('a1-petit-dejeuner')
          if (s === 'cuisine' || s === 'rentrer') void breakfastTutorial()
          else if (s === 'cuisiner') void gp.menus.cook({ tutorial: true })
          else void scene(async () => say(DIALOGUES.cuistot[st().act], 'cuistot')).then(() => gp.menus.cook())
          return
        }
        case 'mila':
        case 'tao':
        case 'pepin':
          if (step('a1-rebord') === 'rebord') void playRebord()
          else void scene(async () => say(greet([...DIALOGUES.enfants, DIALOGUES.musee(st().trouvailles.length)], 'g-enfants'), npcId))
          return
        case 'grand-pere':
          if (step('a1-poulie') === 'carte' || step('a3-pluie') === 'salle') chartTable()
          else void grandpaGeneral()
          return
        case 'bastien':
          if (step('a2-domes') === 'bastien') return void lestScene()
          if (st().act === 2 && step('a2-domes') === 'domes') return void scene(async () => say(DIALOGUES.bastienAvant, 'bastien'))
          return requestTalk('bastien', 'req-bastien', DIALOGUES.reqBastienDemande, () => gp.inv.has('soupe-chaude'), () => gp.inv.take('soupe-chaude'), DIALOGUES.reqBastienFini, () => gp.inv.give('lanterne'), DIALOGUES.bastien)
        case 'nour':
          return requestTalk('nour', 'req-nour', DIALOGUES.reqNourDemande, () => gp.inv.count('algue-doree') >= 2, () => gp.inv.take('algue-doree', 2), DIALOGUES.reqNourFini, () => gp.inv.give('plancton', 3), DIALOGUES.nour)
        case 'maitre-noeud':
          return requestTalk('maitre-noeud', 'req-noeud', DIALOGUES.reqNoeudDemande, () => st().trouvailles.length > 0, () => undefined, DIALOGUES.reqNoeudFini, () => gp.inv.give('toile'), DIALOGUES.noeud)
        case 'mme-cassis':
          return void scene(async () => say(greet(DIALOGUES.cassis, 'g-cassis'), 'mme-cassis')).then(() => gp.menus.market())
        case 'veilleuse-ida':
          return void scene(async () => say(greet(DIALOGUES.ida, 'g-ida'), 'veilleuse-ida'))
        case 'gardien-proue':
          return void scene(async () => say(greet(DIALOGUES.gardien, 'g-gardien'), 'gardien-proue'))
      }
    },
    chartTable,
    setAct(act: Act, announce = false) {
      const s = st()
      const prog = gp.progress()
      if (act >= 2) {
        for (const q of ACT1) s.quests[q] = 'done'
        for (const id of ['frottoir', 'longe', 'poulie']) if (!gp.inv.has(id)) gp.inv.give(id, 1, true)
        if (!prog.domes.includes('dome-ecluse')) prog.domes.push('dome-ecluse')
        for (const t of ['tube-ecluse', 'tube-nef']) if (!prog.tubes.includes(t)) prog.tubes.push(t)
      }
      if (act >= 3) {
        for (const id of ['dome-marche', 'dome-serres', 'dome-nef']) {
          if (mapDomes() >= 3) break
          if (!prog.domes.includes(id)) prog.domes.push(id)
        }
        s.quests['a2-domes'] = 'done'
        s.quests['a2-lest'] = 'done'
        s.flags['lest-vide'] = true
        for (let k = 1; k <= 3; k++) s.flags[`nord-matin-${k}`] = true
        if (!prog.tubes.includes('tube-proue')) prog.tubes.push('tube-proue')
        gp.emit('drift:altitude', { y: 80 })
      }
      s.act = act
      ctx.bus.emit('act:changed', { act })
      if (act === 2 && !step('a2-domes')) set('a2-domes', mapDomes() >= 3 ? 'bastien' : 'domes')
      if (act === 3 && !step('a3-matin')) set('a3-matin', 'refectoire')
      if (act === 1 && !step('a1-reveil')) set('a1-reveil', s.hero.room === 'sas' ? 'tableau' : 'sas')
      gp.weather.morning()
      gp.chart.redraw()
      if (announce) void gp.cine.card(ACT_CARDS[act].titre, ACT_CARDS[act].sous, 3.6)
    },
    candidates(out: Candidate[]) {
      void out
    },
    update() {
      if (ctx.clock.paused) return
      const s = st()
      if (step('a1-reveil') === 'sas' && s.hero.room === 'sas') set('a1-reveil', 'tableau')
      if (step('a3-matin') === 'refectoire' && s.hero.room === 'refectoire' && !running) void matinScene()
      if (step('a1-sortie') === 'coque') {
        const w = ctx.services.drift?.nearestWindow(gp.headPos(), 5)
        if ((w && isBigWindow(w.id)) || !ctx.services.drift) {
          set('a1-sortie', 'done')
          set('a1-grande-vitre', 'frotter')
          gp.hud.tip(TIPS.frotter(ctx.input.keyLabel('scrub')), 7)
        }
      }
      if (step('a1-dome') === 'monter' && s.hero.district === 'ecluse' && gp.heroLocal().y > 12) {
        set('a1-dome', 'lunette')
      }
      if (step('a3-dome-proue') === 'monter' && s.hero.district === 'proue' && !running) {
        void scene(async () => {
          await say(DIALOGUES.domeProue)
          set('a3-dome-proue', 'sortie')
        })
      }
      if (step('a3-dome-proue') === 'sortie' && gp.proue.scrubbed() >= PROUE_PANES) {
        set('a3-dome-proue', 'rentrer')
        gp.hud.tip(TIPS.trappe(ctx.input.keyLabel('interact')), 5)
      }
      if (step('a3-dome-proue') === 'sortie' && s.hero.medium === 'water' && !s.flags['tip-proue-frotter']) {
        s.flags['tip-proue-frotter'] = true
        gp.hud.tip(TIPS.frotter(ctx.input.keyLabel('scrub')), 6)
      }
    },
  }
  return api
}
