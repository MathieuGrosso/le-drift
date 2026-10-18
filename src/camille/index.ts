import * as THREE from 'three'
import type { CelMaterialParams, GameContext, HeroMode, System, SystemId, Vec3 } from '../core/types'
import { Animator, type Pose } from './anim'
import { buildCamille, type CamilleModel } from './model'
import {
  BOCAUX, CABINE_CADEAUX, FINALE_SOL, FINALE_VITRE, POUSSE, REFECTOIRE, SERRES_PTS, VIGIE_BANC, VIGIE_FINALE,
  faceDir, routine, type Spot, type Where,
} from './places'
import { Pousse, gift, jar } from './props'
import {
  APRES_LIGNE, APRES_PLUIE, ASSIS, C, CADEAUX, CADEAU_ARRIVE, CADEAU_KICKER, DOME, FINALE, PLAFOND_SOIR, PROMPTS, QUETE,
  RENCONTRE, TALK, type Line,
} from './text'
import { CamilleUi } from './ui'
import { Vitre } from './vitre'

type Kind = Where | 'vitre' | 'finale' | 'vigie-finale'
type GiftId = keyof typeof CADEAUX

interface Interactable {
  id: string
  reach: number
  pos(): Vec3
  label: string
  active(): boolean
  run(): Promise<void>
}

const BUSY_MODES: ReadonlySet<HeroMode> = new Set<HeroMode>(['cutscene', 'sleep', 'airlock', 'sit', 'lean', 'ladder', 'exhausted'])
const GP_OVERLAYS = '.gp-dialogue.show, .gp-narrate, .gp-credits, .gp-clap'
const WALK_SPEED = 1.1
const RELOCATE_DIST = 14

export function createCamilleSystem(): System {
  let ctxRef: GameContext | null = null
  let ui: CamilleUi | null = null
  let model: CamilleModel | null = null
  let anim: Animator | null = null
  let vitre: Vitre | null = null
  let pousse: Pousse | null = null
  const group = new THREE.Group()
  group.name = 'camille-monde'
  const offs: (() => void)[] = []
  const spots: Interactable[] = []
  const heroLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  const pos: Vec3 = { x: 0, y: 0, z: 0 }
  let yaw = 0
  let kind: Kind | null = null
  let shown = false
  let path: Vec3[] = []
  let ptIndex = 0
  let dwell = 0
  let restPose: Pose = 'idle'
  let talking = false
  let faceHero = 0
  let gpHint = false
  let armed = 0
  let current: Interactable | null = null
  let finaleT = 0
  let finaleStage = 0
  const jars: { root: THREE.Object3D; i: number }[] = []
  const potJars: THREE.Object3D[] = []
  const gifts = new Map<GiftId, THREE.Object3D>()
  let talkIndex = 0
  let wasInCabin = false

  const flag = (id: string) => !!ctxRef?.state.flags[`camille:${id}`]
  const setFlag = (id: string) => {
    if (ctxRef) ctxRef.state.flags[`camille:${id}`] = true
  }
  const jarsFound = () => [0, 1, 2].filter((i) => flag(`bocal:${i}`)).length

  const blocked = (ctx: GameContext) =>
    !ui || ui.busy() || gpHint || BUSY_MODES.has(ctx.state.hero.mode) || document.querySelector(GP_OVERLAYS) !== null

  const talk = async (lines: readonly Line[]) => {
    const ctx = ctxRef
    if (!ctx || !ui) return
    const hero = ctx.services.hero
    const prev = ctx.state.hero.mode
    talking = true
    if (hero) hero.setMode('cutscene')
    else ctx.state.hero.mode = 'cutscene'
    try {
      await ui.say(lines)
    } finally {
      talking = false
      const back: HeroMode = prev === 'cutscene' ? 'cutscene' : ctx.state.hero.medium === 'water' ? 'swim' : 'idle'
      if (hero) hero.setMode(back)
      else ctx.state.hero.mode = back
      armed = 0
    }
  }

  const place = (at: Vec3, y: number, p: Pose) => {
    pos.x = at.x
    pos.y = at.y
    pos.z = at.z
    yaw = y
    if (anim) anim.pose = p
    shown = true
  }

  const heroNear = (p: Vec3, r: number) => Math.hypot(heroLocal.x - p.x, heroLocal.y - p.y, heroLocal.z - p.z) < r

  const benchSpot = (): Spot => {
    const drift = ctxRef?.services.drift
    const seat = drift?.seat('banc-vigie')
    const at = seat ? drift!.toLocal(seat.position) : VIGIE_BANC
    return { at: { x: at.x - 0.75, y: VIGIE_BANC.y, z: at.z }, yaw: 0, pose: 'sit-look-up' }
  }

  const decide = (ctx: GameContext): Kind => {
    const st = ctx.state
    if (vitre?.active()) return 'vitre'
    const q = st.quests
    if (st.act === 3 && (q['a3-matin'] === 'refectoire' || (st.flags['pluie'] && q['a3-pluie'] === 'salle'))) return 'finale'
    if (q['a3-dome-proue'] === 'sortie' || q['a3-dome-proue'] === 'rentrer') return 'vigie-finale'
    return routine(st.time.hours)
  }

  const spotFor = (k: Kind): Spot | null => {
    switch (k) {
      case 'refectoire': return REFECTOIRE
      case 'serres': return SERRES_PTS[ptIndex]!
      case 'proue': return benchSpot()
      case 'finale': return FINALE_SOL
      case 'vigie-finale': return VIGIE_FINALE
      default: return null
    }
  }

  const relocate = (k: Kind) => {
    kind = k
    path = []
    dwell = 8 + Math.random() * 10
    finaleStage = 0
    finaleT = 0
    const s = spotFor(k)
    if (!s) {
      shown = false
      return
    }
    place(s.at, s.yaw, s.pose)
    restPose = s.pose
  }

  const routeTo = (to: Vec3): Vec3[] => {
    if (Math.abs(to.x - pos.x) < 0.5) return [to]
    const cross = Math.abs(pos.z - 20) + Math.abs(to.z - 20) < Math.abs(pos.z - 44) + Math.abs(to.z - 44) ? 20 : 44
    return [{ x: pos.x, y: 0, z: cross }, { x: to.x, y: 0, z: cross }, to]
  }

  const wander = (dt: number) => {
    if (!anim) return
    if (path.length) {
      const t = path[0]!
      const dx = t.x - pos.x
      const dz = t.z - pos.z
      const d = Math.hypot(dx, dz)
      const step = WALK_SPEED * dt
      if (d <= step) {
        pos.x = t.x
        pos.z = t.z
        path.shift()
        if (!path.length) {
          const s = SERRES_PTS[ptIndex]!
          yaw = s.yaw
          restPose = s.pose
          anim.pose = s.pose
          dwell = 15 + Math.random() * 20
        }
      } else {
        pos.x += (dx / d) * step
        pos.z += (dz / d) * step
        yaw = faceDir(dx, dz)
        anim.pose = 'walk'
        anim.speed = 1
      }
      return
    }
    dwell -= dt
    if (restPose === 'prune' && Math.random() < dt * 0.03) anim.pose = anim.pose === 'look-up' ? 'prune' : 'look-up'
    if (dwell <= 0) {
      ptIndex = (ptIndex + 1 + Math.floor(Math.random() * (SERRES_PTS.length - 1))) % SERRES_PTS.length
      path = routeTo(SERRES_PTS[ptIndex]!.at)
    }
  }

  const finale = (ctx: GameContext, dt: number) => {
    if (!anim || !ui) return
    finaleT += dt
    const head = () => headWorld()
    if (finaleStage === 0 && heroNear(FINALE_SOL.at, 7)) {
      ui.speak(head, FINALE.cote)
      finaleStage = 1
    }
    if (ctx.state.flags['pluie'] && finaleStage < 2) {
      finaleStage = 2
      finaleT = 0
    }
    if (finaleStage === 2) {
      const k = Math.min(1, finaleT / 1.6)
      pos.x = FINALE_SOL.at.x + (FINALE_VITRE.at.x - FINALE_SOL.at.x) * k
      pos.y = FINALE_SOL.at.y + (FINALE_VITRE.at.y - FINALE_SOL.at.y) * k
      pos.z = FINALE_SOL.at.z + (FINALE_VITRE.at.z - FINALE_SOL.at.z) * k
      anim.pose = k < 1 ? 'walk' : 'hand-on-glass'
      if (k >= 1) {
        ui.speak(head, FINALE.ronds, 5)
        finaleStage = 3
        finaleT = 0
        setFlag('finale')
      }
    }
    if (finaleStage === 3 && finaleT > 5.5) {
      ui.speak(head, FINALE.main, 6)
      finaleStage = 4
    }
  }

  const headWorld = (): Vec3 | null => {
    if (!model || !shown) return null
    const v = model.joints.head.getWorldPosition(new THREE.Vector3())
    return { x: v.x, y: v.y + 0.45, z: v.z }
  }

  const placeKey = (): keyof typeof TALK => {
    if (kind === 'refectoire' || kind === 'finale') return 'refectoire'
    if (kind === 'serres') return 'serres'
    if (kind === 'proue' || kind === 'vigie-finale') return 'proue'
    return 'ailleurs'
  }

  const quest = async (): Promise<boolean> => {
    const ctx = ctxRef
    if (!ctx || !ui || kind !== 'serres' || ctx.state.act < 2) return false
    if (!flag('quete:debut')) {
      anim!.pose = 'talk'
      await talk(QUETE.debut)
      setFlag('quete:debut')
      for (const j of jars) j.root.visible = !flag(`bocal:${j.i}`)
      ui.toast(QUETE.titre, 'Trouver trois bocaux de lucioles dans les Serres')
      return true
    }
    const n = jarsFound()
    if (n < 3) {
      await talk(QUETE.attente(n))
      return true
    }
    if (!flag('quete:fin')) {
      anim!.pose = 'talk'
      await talk(QUETE.fin.slice(0, 3))
      for (const j of potJars) j.visible = true
      pousse?.set(true)
      ctx.services.audio?.cue('wonder')
      anim!.pose = 'look-up'
      await talk(QUETE.fin.slice(3, 6))
      anim!.pose = 'shy'
      await talk(QUETE.fin.slice(6))
      setFlag('quete:fin')
      ctx.bus.emit('quest:completed', { questId: 'camille-pousse' })
      ui.toast(QUETE.toast, QUETE.titre)
      return true
    }
    return false
  }

  const chat = async () => {
    const ctx = ctxRef
    if (!ctx || !anim) return
    const st = ctx.state
    faceHero = 1
    if (!flag('rencontre')) {
      anim.pose = 'talk'
      await talk(RENCONTRE)
      setFlag('rencontre')
      anim.pose = restPose
      return
    }
    if (await quest()) {
      anim.pose = restPose
      return
    }
    if (kind === 'proue' && st.act >= 2 && !flag('plafond-soir')) {
      anim.pose = 'sit-look-up'
      await talk(PLAFOND_SOIR)
      setFlag('plafond-soir')
      return
    }
    let line: string
    if (st.quests['a3-ligne'] === 'done') line = APRES_LIGNE[talkIndex % APRES_LIGNE.length]!
    else if (st.flags['pluie']) line = APRES_PLUIE[talkIndex % APRES_PLUIE.length]!
    else if (kind === 'serres' && flag('quete:fin') && talkIndex % 3 === 2) line = QUETE.apres
    else {
      const pool = TALK[placeKey()][st.act]
      line = pool[talkIndex % pool.length]!
    }
    talkIndex++
    if (kind !== 'proue') anim.pose = talkIndex % 4 === 0 ? 'shy' : 'talk'
    await talk([[C, line]])
    anim.pose = restPose
  }

  const giftReady = (id: GiftId): boolean => {
    const st = ctxRef!.state
    if (id === 'feuille') return flag('vitre:bonjour')
    if (id === 'dessin') return st.act >= 2 && flag('vitre:chose')
    if (id === 'bocal') return flag('quete:fin')
    return st.quests['a3-ligne'] === 'done'
  }

  const showGift = (mat: (c: number) => THREE.Material, id: GiftId) => {
    if (gifts.has(id)) return
    const o = gift(mat, id, CABINE_CADEAUX[id])
    group.add(o)
    gifts.set(id, o)
  }

  const deliver = (ctx: GameContext, mat: (c: number) => THREE.Material) => {
    const inCabin = ctx.services.drift?.cellAt(heroLocal) === 'cabine'
    if (!inCabin) {
      for (const id of Object.keys(CADEAUX) as GiftId[]) {
        if (flag(`cadeau:${id}`) || !giftReady(id)) continue
        setFlag(`cadeau:${id}`)
        showGift(mat, id)
      }
    } else if (!wasInCabin) {
      const unseen = (Object.keys(CADEAUX) as GiftId[]).some((id) => flag(`cadeau:${id}`) && !flag(`cadeau-vu:${id}`))
      if (unseen) ui?.toast(CADEAU_KICKER, CADEAU_ARRIVE)
    }
    wasInCabin = inCabin
  }

  const buildSpots = () => {
    const at = (p: Vec3, dy = 0) => () => ({ x: p.x, y: p.y + dy, z: p.z })
    spots.push({
      id: 'camille', reach: 1.9, label: PROMPTS.parler,
      pos: () => ({ x: pos.x, y: pos.y + 0.9, z: pos.z }),
      active: () => shown && kind !== 'vitre' && kind !== 'dodo',
      run: chat,
    })
    spots.push({
      id: 'banc', reach: 1.3, label: PROMPTS.asseoir,
      pos: () => ({ x: pos.x + 0.75, y: pos.y + 0.5, z: pos.z }),
      active: () => shown && kind === 'proue' && flag('plafond-soir'),
      run: async () => {
        ctxRef?.services.hero?.sit('banc-vigie')
        await new Promise((r) => window.setTimeout(r, 1200))
        await talk(ASSIS)
      },
    })
    BOCAUX.forEach((b, i) => {
      spots.push({
        id: `bocal-${i}`, reach: 1.6, label: PROMPTS.ramasser, pos: at(b, 0.1),
        active: () => flag('quete:debut') && !flag(`bocal:${i}`),
        run: async () => {
          setFlag(`bocal:${i}`)
          const j = jars.find((x) => x.i === i)
          if (j) j.root.visible = false
          ctxRef?.services.audio?.sfx('trouvaille')
          const t = QUETE.bocaux[i]!
          ui?.toast(`${QUETE.titre} ${QUETE.compte(jarsFound())}`, t.nom, t.note)
        },
      })
    })
    for (const id of Object.keys(CADEAUX) as GiftId[]) {
      spots.push({
        id: `cadeau-${id}`, reach: 1.7, label: PROMPTS.regarder, pos: at(CABINE_CADEAUX[id]),
        active: () => flag(`cadeau:${id}`),
        run: async () => {
          setFlag(`cadeau-vu:${id}`)
          ui?.toast(CADEAU_KICKER, CADEAUX[id].nom, CADEAUX[id].note)
        },
      })
    }
  }

  const pick = (ctx: GameContext): Interactable | null => {
    if (ctx.state.hero.medium !== 'air') return null
    let best: Interactable | null = null
    let bestD = Infinity
    for (const s of spots) {
      if (!s.active()) continue
      const p = s.pos()
      if (Math.abs(heroLocal.y + 0.8 - p.y) > 2.2) continue
      const d = Math.hypot(heroLocal.x - p.x, heroLocal.z - p.z)
      if (d > s.reach || d >= bestD) continue
      best = s
      bestD = d
    }
    return best
  }

  let matFn: ((c: number) => THREE.Material) | null = null

  return {
    id: 'camille' as string as SystemId,
    init(ctx) {
      ctxRef = ctx
      const cache = new Map<string, THREE.Material>()
      const cel = (p: CelMaterialParams): THREE.Material => {
        const key = JSON.stringify(p)
        const hit = cache.get(key)
        if (hit) return hit
        let m: THREE.Material
        try {
          m = ctx.services.render ? ctx.services.render.cel(p) : new THREE.MeshLambertMaterial({ color: p.color, vertexColors: !!p.vertexColors })
        } catch {
          m = new THREE.MeshLambertMaterial({ color: p.color, vertexColors: !!p.vertexColors })
        }
        cache.set(key, m)
        return m
      }
      const mat = (color: number) => cel({ color, indoor: true })
      matFn = mat
      ui = new CamilleUi(ctx)
      model = buildCamille(cel({ color: 0xffffff, vertexColors: true, indoor: true }))
      anim = new Animator(model)
      group.add(model.root)
      model.root.visible = false

      pousse = new Pousse(mat, POUSSE)
      pousse.set(flag('quete:fin'), true)
      group.add(pousse.root)
      BOCAUX.forEach((b, i) => {
        const j = jar(mat, b)
        j.root.visible = flag('quete:debut') && !flag(`bocal:${i}`)
        group.add(j.root)
        jars.push({ root: j.root, i })
      })
      for (const [dx, dz] of [[0.55, 0.1], [-0.4, 0.4], [0.05, -0.55]] as const) {
        const j = jar(mat, { x: POUSSE.x + dx, y: POUSSE.y, z: POUSSE.z + dz })
        j.root.visible = flag('quete:fin')
        group.add(j.root)
        potJars.push(j.root)
      }
      for (const id of Object.keys(CADEAUX) as GiftId[]) if (flag(`cadeau:${id}`)) showGift(mat, id)

      const driftRoot = ctx.scene.getObjectByName('le-drift')
      ;(driftRoot ?? ctx.scene).add(group)

      vitre = new Vitre(ctx, ui, group, {
        stand: (at, y, p) => {
          kind = 'vitre'
          path = []
          place(at, y, p)
        },
        pose: (p) => {
          if (anim) anim.pose = p
        },
        leave: () => {
          kind = null
          shown = false
        },
        talk,
        flag,
        setFlag,
        blocked: () => blocked(ctx),
      })
      buildSpots()

      offs.push(ctx.bus.on('interact:hint', (h) => {
        gpHint = h !== null && h.id !== 'longe' && !h.id.startsWith('cueillette:')
      }))
      offs.push(ctx.bus.on('game:paused', ({ paused }) => {
        if (paused) ui?.showPrompt(null)
      }))
      offs.push(ctx.bus.on('quest:step', ({ questId, step }) => {
        if (questId === 'a3-dome-proue' && step === 'sortie' && !flag('dome')) {
          setFlag('dome')
          window.setTimeout(() => ui?.toast('Vigie', DOME), 4000)
        }
      }))
    },

    update(dt, ctx) {
      if (!model || !anim || !ui) return
      ui.update(dt)
      const drift = ctx.services.drift
      if (drift) {
        const l = drift.toLocal(ctx.state.hero.position)
        heroLocal.x = l.x
        heroLocal.y = l.y
        heroLocal.z = l.z
      }
      vitre?.update(dt, heroLocal)
      pousse?.update(dt)

      const want = decide(ctx)
      if (want !== kind && want !== 'vitre' && !talking) {
        const s = spotFor(want)
        const urgent = want === 'finale' || want === 'vigie-finale' || kind === null
        const unseen = !shown || !heroNear(pos, RELOCATE_DIST)
        const targetUnseen = !s || !heroNear(s.at, RELOCATE_DIST)
        if (urgent || (unseen && targetUnseen)) relocate(want)
      }
      if (kind === 'serres' && !talking) wander(dt)
      if (kind === 'finale') finale(ctx, dt)

      if (talking && faceHero > 0) yaw = faceDir(heroLocal.x - pos.x, heroLocal.z - pos.z)
      else faceHero = 0
      model.root.visible = shown
      model.root.position.set(pos.x, pos.y, pos.z)
      let dy = yaw - model.root.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      model.root.rotation.y += dy * Math.min(1, dt * 6)
      if (shown) anim.update(dt)
      if (matFn) deliver(ctx, matFn)

      if (blocked(ctx) || vitre?.active()) {
        armed = 0
        if (current) {
          current = null
          ui.showPrompt(null)
        }
        return
      }
      armed += dt
      const spot = pick(ctx)
      if (spot !== current) {
        current = spot
        ui.showPrompt(spot ? spot.label : null)
      }
      if (spot && armed > 0.3 && ctx.input.pressed('interact')) {
        current = null
        ui.showPrompt(null)
        void spot.run()
      }
    },

    dispose() {
      for (const off of offs.splice(0)) off()
      vitre?.dispose()
      group.removeFromParent()
      ui?.dispose()
      ui = null
      ctxRef = null
    },
  }
}
