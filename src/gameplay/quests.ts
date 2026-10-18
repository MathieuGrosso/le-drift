import { SONDES } from '../core/layout'
import type { Act, Vec3 } from '../core/types'
import { dist3, type Candidate, type Gp, type Line, type Quests } from './context'
import { ACT_CARDS, DIALOGUES, PROMPTS, QUESTS, TIPS, UI } from './text/fr'
import { northMornings } from './weather'

const ACT1 = [
  'a1-reveil', 'a1-corde', 'a1-grande-vitre', 'a1-chose', 'a1-petit-dejeuner', 'a1-rebord', 'a1-grand-pere', 'a1-sonde', 'a1-voile',
] as const
const ORDER = [...ACT1, 'a2-sondes', 'a3-matin', 'a3-pluie', 'a3-mesures', 'a3-seuil', 'a2-raie'] as const
const FIRST_SONDE = 'sonde-promontoire'
const isBigWindow = (id: string) => /grande/.test(id)
const isGrandpaWindow = (id: string) => /grand-?pere/.test(id)

export function createQuests(gp: Gp): Quests {
  const ctx = gp.ctx
  const st = () => ctx.state
  let running = false
  let cornerTimer = 0
  let started = false

  const say = (lines: readonly Line[], npc?: string) => gp.dialogue.play(lines, npc)

  const settle = async <T>(p: Promise<T> | undefined, seconds: number): Promise<void> => {
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

  const sondesNorth = () => st().chart.sondes.filter((s) => s !== FIRST_SONDE).length

  const set = (questId: string, step: string) => {
    const q = st().quests
    if (q[questId] === step) return
    if (q[questId] === 'done' && step !== 'done') return
    q[questId] = step
    if (step === 'done') {
      ctx.bus.emit('quest:step', { questId, step })
      ctx.bus.emit('quest:completed', { questId })
      return
    }
    ctx.bus.emit('quest:step', { questId, step })
    const text = QUESTS[questId]?.steps[step]
    if (text) gp.toast(`${UI.nouvelleTache} : ${text}`)
  }
  const step = (id: string) => st().quests[id]

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
    const d = ctx.services.drift
    const w = d?.nearestWindow(gp.heroPos(), 40)
    if (w && isBigWindow(w.id)) return w.position
    const p = st().drift.position
    return { x: p.x, y: p.y, z: p.z + 60 }
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
      await gp.cine.wait(1.4)
      gp.menus.close()
      await say(DIALOGUES.cuistotApres, 'cuistot')
      await settle(ctx.services.drift?.playScene('petit-dejeuner'), 25)
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
      set('a1-grand-pere', 'vitre')
      gp.hud.tip(TIPS.sac(ctx.input.keyLabel('inventory')))
    })

  const carteScene = () =>
    scene(async () => {
      await say(DIALOGUES.carte, 'grand-pere')
      set('a1-grand-pere', 'done')
      set('a1-sonde', 'sonde')
    }).then(() => gp.chart.open())

  const voileScene = () =>
    scene(async () => {
      await say(DIALOGUES.voile, 'grand-pere')
      gp.inv.give('voile')
      set('a1-voile', 'done')
      gp.hud.tip(TIPS.voile(ctx.input.keyLabel('up')), 7)
      await gp.cine.wait(1.5)
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
      await ripples(8, target, 20, 0.25)
      set('a3-matin', 'done')
      set('a3-pluie', 'salle')
    })

  const pluieScene = () =>
    scene(async () => {
      st().flags['pluie'] = true
      gp.weather.set({ rain: 1 })
      gp.cue('rain')
      const drift = ctx.services.drift
      const play = drift?.playScene('grand-pere-pluie')
      void ripples(40, st().drift.position, 160, 0.12)
      await say(DIALOGUES.pluie, 'grand-pere')
      await settle(play, 8)
      gp.inv.give('stylo')
      set('a3-pluie', 'done')
      set('a3-mesures', 'reperes')
    })

  const grandpaGeneral = () =>
    scene(async () => {
      if (gp.inv.count('nacre') >= 4) {
        await say(DIALOGUES.nacres, 'grand-pere')
        gp.inv.take('nacre', 4)
        gp.inv.addNacreUpgrade()
        gp.breath.refill()
        gp.toast(UI.souffleAllonge)
        gp.sfx('souffle-plus')
        return
      }
      if (st().act === 2) {
        const left = Math.max(0, 3 - sondesNorth())
        await say(step('a2-sondes') === 'rentrer' ? DIALOGUES.troisSondes : DIALOGUES.sondesRestantes(left), 'grand-pere')
        return
      }
      await say(DIALOGUES.grandPere[st().act], 'grand-pere')
    })

  const chartTable = () => {
    if (step('a1-grand-pere') === 'carte') void carteScene()
    else if (step('a1-voile') === 'retour') void voileScene()
    else if (step('a3-pluie') === 'salle') void pluieScene()
    else gp.chart.open()
  }

  const greet = (pool: readonly (readonly Line[])[], key: string) => {
    const n = (st().flags[key] ? 1 : 0) + st().time.day + Math.floor(st().time.hours)
    st().flags[key] = !st().flags[key]
    return pool[n % pool.length]!
  }

  ctx.bus.on('room:entered', ({ roomId }) => {
    if (roomId === 'sas' && step('a1-reveil') === 'sas') set('a1-reveil', 'tableau')
    if (roomId === 'cuisine' && step('a1-petit-dejeuner') === 'cuisine') void breakfastTutorial()
    if (roomId === 'rebord' && step('a1-rebord') === 'rebord') void playRebord()
    if (roomId === 'refectoire' && step('a3-matin') === 'refectoire') void matinScene()
  })
  ctx.bus.on('hero:medium', ({ medium }) => {
    if (medium === 'water' && step('a1-reveil') === 'sortir') {
      set('a1-reveil', 'done')
      set('a1-corde', 'coque')
      gp.hud.tip(TIPS.nage(ctx.input.keyLabel('up'), ctx.input.keyLabel('down')), 8)
    }
    if (medium === 'air' && step('a1-petit-dejeuner') === 'rentrer') set('a1-petit-dejeuner', 'cuisine')
  })
  ctx.bus.on('scrub:done', ({ windowId }) => {
    if (step('a1-grande-vitre') === 'frotter' && (isBigWindow(windowId) || !ctx.services.drift)) void afterBigWindow()
    else if (step('a1-grand-pere') === 'vitre' && isGrandpaWindow(windowId)) {
      set('a1-grand-pere', 'carte')
      void say(DIALOGUES.vitreGrandPere)
    }
  })
  ctx.bus.on('cook:done', () => {
    if (step('a1-petit-dejeuner') === 'cuisiner') void finishBreakfast()
  })
  ctx.bus.on('sonde:activated', ({ sondeId }) => {
    if (step('a1-sonde') === 'sonde') {
      set('a1-sonde', 'done')
      set('a1-voile', 'retour')
    }
    if (st().act === 2 && sondeId !== FIRST_SONDE && step('a2-sondes') === 'sondes') {
      const n = sondesNorth()
      if (n >= 3) set('a2-sondes', 'rentrer')
      else gp.toast(`${QUESTS['a2-sondes']!.titre} : ${n}/3`)
    }
  })
  ctx.bus.on('sleep:done', ({ toHour }) => {
    if (st().act !== 2) return
    if (step('a2-sondes') === 'rentrer') {
      set('a2-sondes', 'done')
      api.setAct(3, true)
      return
    }
    if (toHour === 6) {
      const k = northMornings(st().flags)
      if (k < 3) {
        st().flags[`nord-matin-${k + 1}`] = true
        void say(DIALOGUES.matinsNord[k]!)
      }
    }
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
        if (id === 'a2-sondes' && s === 'sondes') t += ` (${sondesNorth()}/3)`
        if (id === 'a3-mesures') t += ` (${st().chart.reperes.length}/3)`
        return t
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
            })
          } else void scene(async () => say(greet(DIALOGUES.rouille, 'g-rouille'), 'mme-rouille')).then(() => gp.menus.board())
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
          else {
            const pool = [...DIALOGUES.enfants, DIALOGUES.musee(st().trouvailles.length)]
            void scene(async () => say(greet(pool, 'g-enfants'), npcId))
          }
          return
        case 'grand-pere':
          if (step('a1-grand-pere') === 'carte' || step('a1-voile') === 'retour' || step('a3-pluie') === 'salle') chartTable()
          else void grandpaGeneral()
          return
      }
    },
    chartTable,
    setAct(act: Act, announce = false) {
      const s = st()
      if (act >= 2) {
        for (const q of ACT1) s.quests[q] = 'done'
        for (const id of ['frottoir', 'lest', 'voile']) if (!gp.inv.has(id)) gp.inv.give(id, 1, true)
        if (!s.chart.sondes.includes(FIRST_SONDE)) s.chart.sondes.push(FIRST_SONDE)
      }
      if (act >= 3) {
        for (const id of ['sonde-pilier', 'sonde-laminaires', 'sonde-cheminee', 'sonde-coques']) {
          if (sondesNorth() >= 3) break
          if (!s.chart.sondes.includes(id) && SONDES.some((x) => x.id === id)) s.chart.sondes.push(id)
        }
        s.quests['a2-sondes'] = 'done'
        for (let k = 1; k <= 3; k++) s.flags[`nord-matin-${k}`] = true
      }
      s.act = act
      ctx.bus.emit('act:changed', { act })
      if (act === 2) {
        set('a2-sondes', sondesNorth() >= 3 ? 'rentrer' : 'sondes')
        if (!step('a2-raie')) {
          set('a2-raie', 'raie')
          ctx.services.fauna?.spawnScripted('raie-coincee')
        }
      }
      if (act === 3) set('a3-matin', 'refectoire')
      if (act === 1 && !step('a1-reveil')) set('a1-reveil', s.hero.room === 'sas' ? 'tableau' : 'sas')
      gp.weather.morning()
      gp.chart.redraw()
      if (announce) void gp.cine.card(ACT_CARDS[act].titre, ACT_CARDS[act].sous, 3.6)
    },
    repere(id) {
      const s = st()
      if (s.chart.reperes.includes(id)) return
      s.chart.reperes.push(id)
      gp.sfx('stylo')
      void scene(async () => {
        await say(s.chart.reperes.length === 1 ? DIALOGUES.repere : [[null, UI.repereLabel(s.chart.reperes.length)]])
        await gp.chart.drawLine()
        if (s.chart.reperes.length >= 3 && step('a3-mesures') === 'reperes') {
          await say(DIALOGUES.reperesFini)
          set('a3-mesures', 'done')
          set('a3-seuil', 'seuil')
        }
      })
    },
    candidates(out: Candidate[]) {
      const fauna = ctx.services.fauna
      const manta = fauna?.manta()
      if (!manta || st().hero.medium !== 'water') return
      const d = dist3(gp.heroPos(), manta.position)
      if (d > 4.5) return
      if (!st().flags['raie']) {
        out.push({
          id: 'raie', kind: 'manta', label: PROMPTS.nourrir, key: 'interact', dist: d,
          run: () =>
            void scene(async () => {
              if (!gp.inv.take('poisson')) {
                await say(st().flags['raie-vue'] ? DIALOGUES.raiePasDePoisson : DIALOGUES.raieVue)
                st().flags['raie-vue'] = true
                return
              }
              await say(DIALOGUES.raieNourrie)
              st().flags['raie'] = true
              gp.inv.give('sifflet-raie')
              set('a2-raie', 'done')
            }),
        })
      } else if (st().hero.mode !== 'ride') {
        out.push({
          id: 'raie', kind: 'manta', label: PROMPTS.chevaucher, key: 'interact', dist: d,
          run: () => {
            manta.mount()
            gp.heroMode('ride')
          },
        })
      }
    },
    update(dt) {
      if (ctx.clock.paused) return
      const s = st()
      if (step('a1-reveil') === 'sas' && s.hero.room === 'sas') set('a1-reveil', 'tableau')
      if (step('a3-matin') === 'refectoire' && s.hero.room === 'refectoire' && !running) void matinScene()
      if (step('a1-corde') === 'coque') {
        cornerTimer += dt
        const w = ctx.services.drift?.nearestWindow(gp.headPos(), 10)
        const reached = w ? isBigWindow(w.id) || dist3(gp.headPos(), w.position) < 4 : !ctx.services.drift && cornerTimer > 8
        if (reached) {
          set('a1-corde', 'done')
          set('a1-grande-vitre', 'frotter')
          gp.hud.tip(TIPS.frotter(ctx.input.keyLabel('scrub')), 7)
        } else if (s.hero.mode === 'climb' && !s.flags['tip-grimper']) {
          s.flags['tip-grimper'] = true
          gp.hud.tip(TIPS.grimper, 6)
        }
      } else cornerTimer = 0
      if (s.flags['raie'] && ctx.input.pressed('whistle') && !gp.busy()) gp.sfx('sifflet', s.hero.position)
    },
  }
  return api
}
