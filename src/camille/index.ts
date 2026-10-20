import * as THREE from 'three'
import type { CelMaterialParams, GameContext, HeroMode, System, SystemId, Vec3 } from '../core/types'
import { Animator, type Pose } from './anim'
import { buildCamille, type CamilleModel } from './model'
import {
  BOCAUX, CABINE_CADEAUX, COURSIVE, COURSIVE_DEPART, DEJEUNER, DODO, ETAGERE, ETAGERE_MEUBLE, FINALE_SOL, FINALE_VITRE,
  POUSSE, REFECTOIRE, SERRES_PTS, VIGIE_BANC, VIGIE_FINALE, breakfastAhead, faceDir, routine, type Spot, type Where,
} from './places'
import { Pousse, etagere, gift, jar } from './props'
import {
  APRES_LIGNE, APRES_PLUIE, ASSIS, C, CADEAUX, CADEAU_ARRIVE, CADEAU_KICKER, COURSIVE as COURSIVE_TXT, DEJEUNER as DEJ_TXT,
  DOME, ETAGERE as ETAGERE_TXT, FINALE, INDICES, PLAFOND_SOIR, PROMPTS, QUETE, REJOINDRE, RENCONTRE, RENCONTRE_SEC,
  SERRES_OUVERTES, TALK, type Line,
} from './text'
import { CamilleUi } from './ui'
import { Vitre } from './vitre'

type Kind = Where | 'vitre' | 'finale' | 'vigie-finale' | 'coursive' | 'dejeuner' | 'etagere'
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
  let restPose: Pose = 'pockets'
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
  let arrive: Spot | null = null
  let greetT = -1
  let knockT = 0
  let sceneT = 0
  let sceneStep = 0
  let nightWake = false
  let lastNear = 0
  let lastHint = -1e9
  let pendingJoin = new URLSearchParams(location.search).get('voir')?.toLowerCase() === 'ondine'
  let readyFrames = 0
  let joinCam: Vec3 | null = null
  let joining = false

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
    const r = routine(st.time.hours)
    if (r === 'dodo' && nightWake) return 'dodo'
    nightWake = false
    if (st.act === 1) {
      if (!flag('coursive') && !q['a1-sortie'] && breakfastAhead(st.time.hours)) return 'coursive'
      const pd = q['a1-petit-dejeuner']
      if (pd === 'cuisine' || pd === 'cuisiner' || (pd === 'done' && q['a1-rebord'] !== 'done')) return 'dejeuner'
      if (r === 'serres') return 'etagere'
    }
    return r
  }

  const spotFor = (k: Kind): Spot | null => {
    switch (k) {
      case 'refectoire': return REFECTOIRE
      case 'serres': return SERRES_PTS[ptIndex]!
      case 'proue': return benchSpot()
      case 'finale': return FINALE_SOL
      case 'vigie-finale': return VIGIE_FINALE
      case 'coursive': return COURSIVE
      case 'dejeuner': return DEJEUNER
      case 'etagere': return ETAGERE
      case 'dodo': return nightWake ? DODO : null
      default: return null
    }
  }

  const relocate = (k: Kind) => {
    kind = k
    path = []
    dwell = 8 + Math.random() * 10
    finaleStage = 0
    finaleT = 0
    arrive = null
    greetT = -1
    sceneT = 0
    sceneStep = 0
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

  const walk = (dt: number) => {
    if (!anim || !path.length) return
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
          const s = arrive ?? SERRES_PTS[ptIndex]!
          arrive = null
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
  }

  const wander = (dt: number) => {
    if (!anim || path.length) return
    dwell -= dt
    if (restPose !== 'look-up' && Math.random() < dt * 0.03) anim.pose = anim.pose === 'look-up' ? restPose : 'look-up'
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

  const faceTo = (x: number, z: number) => {
    yaw = faceDir(x - pos.x, z - pos.z)
  }

  const leaveCoursive = () => {
    setFlag('coursive')
    arrive = { at: COURSIVE_DEPART[COURSIVE_DEPART.length - 1]!, yaw: faceDir(1, 0), pose: 'pockets' }
    path = COURSIVE_DEPART.map((p) => ({ ...p }))
  }

  const coursive = (ctx: GameContext, dt: number) => {
    if (!anim || !ui || flag('coursive')) return
    const inCabin = ctx.services.drift?.cellAt(heroLocal) === 'cabine'
    if (greetT < 0) {
      if (!breakfastAhead(ctx.state.time.hours)) return
      if (inCabin && !heroNear(pos, 4.5)) {
        knockT += dt
        if (knockT > 22) {
          knockT = -18
          ui.speak(headWorld, COURSIVE_TXT.toc, 3.5, true)
          ctx.services.audio?.sfx('glass-tap', ctx.services.drift?.toWorld(pos))
        }
      } else if (!inCabin && heroNear(pos, 7.5)) {
        knockT = 0
        greetT = 0
        anim.pose = 'wave'
        ui.speak(headWorld, COURSIVE_TXT.salut, 3)
      }
      return
    }
    const prev = greetT
    greetT += dt
    faceTo(heroLocal.x, heroLocal.z)
    if (prev < 2.8 && greetT >= 2.8) {
      anim.pose = 'talk'
      ui.speak(headWorld, COURSIVE_TXT.suite, 4)
    }
    if (greetT > 7.5 || (greetT > 3 && !heroNear(pos, 10))) {
      ui.speak(headWorld, COURSIVE_TXT.part, 3)
      leaveCoursive()
    }
  }

  const dejeuner = (ctx: GameContext, dt: number) => {
    if (!anim || !ui) return
    const seated = ctx.state.hero.mode === 'sit' && heroNear(pos, 3)
    if (sceneStep === 0 && (seated || heroNear(pos, 4))) {
      sceneStep = 1
      sceneT = 0
      ui.speak(headWorld, DEJ_TXT.place, 4.5)
    }
    if (sceneStep >= 1) sceneT += dt
    if (sceneStep === 1 && seated && sceneT > 5) {
      sceneStep = 2
      sceneT = 0
      anim.pose = 'laugh'
      ui.speak(headWorld, ctx.state.quests['a1-chose'] === 'done' ? DEJ_TXT.tortue : DEJ_TXT.pain, 4.5)
    }
    if (sceneStep === 2 && sceneT > 6) {
      sceneStep = 3
      anim.pose = 'eat'
      ui.speak(headWorld, DEJ_TXT.pain, 4)
    }
  }

  const signal = (ctx: GameContext, dt: number) => {
    if (!anim || !ui) return
    const outside = ctx.state.mode === 'sortie' || ctx.state.hero.medium === 'water'
    if (sceneStep === 0 && outside && heroNear(pos, 16)) {
      sceneStep = 1
      sceneT = 0
      faceTo(pos.x, pos.z + 5)
      anim.pose = 'wave'
      if (!flag('etagere:signe')) {
        setFlag('etagere:signe')
        ui.toast(ETAGERE_TXT.nom, ETAGERE_TXT.vitre)
      }
    }
    if (sceneStep === 1) {
      sceneT += dt
      if (sceneT > 7) {
        sceneStep = outside ? 2 : 0
        yaw = ETAGERE.yaw
        anim.pose = restPose
      }
    }
    if (sceneStep === 2 && !outside) sceneStep = 0
  }

  const hint = (ctx: GameContext) => {
    const now = ctx.clock.elapsed
    if (shown && heroNear(pos, 14)) lastNear = now
    if (!kind || !(kind in INDICES) || ctx.state.mode === 'sortie' || ctx.state.hero.medium !== 'air') return
    if (now - lastNear < 150 || now - lastHint < 300) return
    if (!ui || ui.busy() || BUSY_MODES.has(ctx.state.hero.mode) || document.querySelector(GP_OVERLAYS)) return
    lastHint = now
    const [who, line] = INDICES[kind as keyof typeof INDICES]
    ui?.toast(who, line)
  }

  const standPoint = (ctx: GameContext): Vec3 => {
    const drift = ctx.services.drift
    const chest = drift?.toWorld({ x: pos.x, y: pos.y + 1.1, z: pos.z })
    for (const a of [0, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI, (3 * Math.PI) / 4, (-3 * Math.PI) / 4]) {
      for (const r of [2.1, 1.5]) {
        const p = { x: pos.x - Math.sin(yaw + a) * r, y: pos.y, z: pos.z - Math.cos(yaw + a) * r }
        if (!drift || !chest) return p
        const top = drift.toWorld({ x: p.x, y: pos.y + 1.1, z: p.z })
        const dir = { x: top.x - chest.x, y: top.y - chest.y, z: top.z - chest.z }
        const len = Math.hypot(dir.x, dir.y, dir.z)
        const block = ctx.physics.raycast(chest, { x: dir.x / len, y: dir.y / len, z: dir.z / len }, len + 0.4, { excludeKinds: ['trigger', 'fauna'] })
        if (block) continue
        const down = ctx.physics.raycast(top, { x: 0, y: -1, z: 0 }, 1.6, { excludeKinds: ['trigger', 'fauna'] })
        if (!down || Math.abs(1.1 - down.distance) > 0.35) continue
        return p
      }
    }
    return { x: pos.x - Math.sin(yaw) * 1.4, y: pos.y, z: pos.z - Math.cos(yaw) * 1.4 }
  }

  const join = async () => {
    const ctx = ctxRef
    if (!ctx || !ui || !anim || talking || joining) return
    joining = true
    try {
      await joinNow(ctx)
    } finally {
      joining = false
    }
  }

  const joinNow = async (ctx: GameContext) => {
    if (!ui || !anim) return
    const st = ctx.state
    if (st.mode === 'sortie' || st.hero.medium === 'water') {
      const dbg = (window as unknown as { __game?: { endSortie?: () => Promise<void> } }).__game
      await dbg?.endSortie?.()
    }
    vitre?.abort()
    if (routine(st.time.hours) === 'dodo') nightWake = true
    let want = decide(ctx)
    if (want === 'vitre') want = routine(st.time.hours)
    relocate(want)
    if (!shown) return
    const hero = ctx.services.hero
    if (st.hero.mode === 'sit' || st.hero.mode === 'lean') hero?.stand()
    const p = standPoint(ctx)
    const heroYaw = Math.atan2(pos.x - p.x, -(pos.z - p.z))
    if (hero) hero.teleportLocal(p, heroYaw)
    st.hero.localPosition = { ...p }
    heroLocal.x = p.x
    heroLocal.y = p.y
    heroLocal.z = p.z
    faceTo(p.x, p.z)
    if (model) model.root.rotation.y = yaw
    lastNear = ctx.clock.elapsed
    await new Promise((r) => window.setTimeout(r, 450))
    faceHero = 1
    anim.pose = 'wave'
    let lines: readonly Line[]
    if (kind === 'coursive') {
      lines = [[C, COURSIVE_TXT.salut], [C, COURSIVE_TXT.suite]]
    } else if (kind === 'dodo') lines = [[C, REJOINDRE.nuit]]
    else if (!flag('rencontre')) lines = [[C, REJOINDRE.inconnu]]
    else lines = [[C, REJOINDRE.ami[talkIndex++ % REJOINDRE.ami.length]!]]
    joinCam = { ...p }
    try {
      await talk(lines)
    } finally {
      joinCam = null
      hero?.setCameraPose(null)
    }
    if (kind === 'coursive') leaveCoursive()
    else anim.pose = restPose
  }

  const frameJoin = (ctx: GameContext) => {
    const drift = ctx.services.drift
    const hero = ctx.services.hero
    if (!joinCam || !drift || !hero) return
    const h = joinCam
    const dx = pos.x - h.x
    const dz = pos.z - h.z
    const d = Math.hypot(dx, dz) || 1
    const nx = -dz / d
    const nz = dx / d
    const mid = { x: (pos.x + h.x) / 2 - (dx / d) * 0.5, y: h.y + 1.5, z: (pos.z + h.z) / 2 - (dz / d) * 0.5 }
    const eye = drift.toWorld(mid)
    let best = { k: 0, dist: -1 }
    for (const k of [1, -1]) {
      const tip = drift.toWorld({ x: mid.x + nx * k, y: mid.y, z: mid.z + nz * k })
      const dir = { x: tip.x - eye.x, y: tip.y - eye.y, z: tip.z - eye.z }
      const hit = ctx.physics.raycast(eye, dir, 3.4, { excludeKinds: ['trigger', 'fauna', 'glass', 'window'] })
      const dist = hit ? hit.distance - 0.3 : 3.4
      if (dist > best.dist) best = { k, dist }
    }
    const r = Math.max(0.8, best.dist)
    const position = drift.toWorld({ x: mid.x + nx * best.k * r, y: mid.y + 0.25, z: mid.z + nz * best.k * r })
    const target = drift.toWorld({ x: pos.x * 0.65 + h.x * 0.35, y: h.y + 1.2, z: pos.z * 0.65 + h.z * 0.35 })
    hero.setCameraPose({ position, target })
  }

  const headWorld = (): Vec3 | null => {
    if (!model || !shown) return null
    const v = model.joints.head.getWorldPosition(new THREE.Vector3())
    return { x: v.x, y: v.y + 0.45, z: v.z }
  }

  const placeKey = (): keyof typeof TALK => {
    if (kind === 'refectoire' || kind === 'finale' || kind === 'dejeuner') return 'refectoire'
    if (kind === 'serres') return 'serres'
    if (kind === 'etagere') return 'etagere'
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
      await talk(st.hero.wetness > 0.2 ? RENCONTRE : RENCONTRE_SEC)
      setFlag('rencontre')
      if (kind === 'coursive') leaveCoursive()
      else anim.pose = restPose
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
      group.add(etagere(mat, ETAGERE_MEUBLE, Math.PI / 2))

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
      offs.push(ctx.bus.on('ondine:rejoindre', () => void join()))
      offs.push(ctx.bus.on('act:changed', ({ act }) => {
        if (act !== 2 || flag('serres-ouvertes')) return
        setFlag('serres-ouvertes')
        window.setTimeout(() => ui?.toast(SERRES_OUVERTES.kicker, SERRES_OUVERTES.text), 6000)
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
      if (!talking && !joining) walk(dt)
      if (kind === 'serres' && !talking) wander(dt)
      if (kind === 'finale') finale(ctx, dt)
      if (kind === 'coursive' && !talking && !joining) coursive(ctx, dt)
      if (kind === 'dejeuner' && !talking) dejeuner(ctx, dt)
      if (kind === 'etagere' && !talking && !path.length) signal(ctx, dt)
      hint(ctx)
      frameJoin(ctx)
      if (pendingJoin) {
        const ready = ctx.state.time.scale > 0 && !ctx.state.debug.cameraLocked && !blocked(ctx)
        readyFrames = ready ? readyFrames + 1 : 0
        if (readyFrames > 45) {
          pendingJoin = false
          void join()
        }
      }

      if (talking && faceHero > 0) yaw = faceDir(heroLocal.x - pos.x, heroLocal.z - pos.z)
      else faceHero = 0
      model.root.visible = shown
      model.root.position.set(pos.x, pos.y, pos.z)
      let dy = yaw - model.root.rotation.y
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      model.root.rotation.y += dy * Math.min(1, dt * 6)
      if (shown) {
        const evening = kind === 'refectoire' || kind === 'proue' || kind === 'finale' || kind === 'vigie-finale'
        model.setOutfit(evening ? 'soir' : 'jour')
        const p = anim.pose
        model.hold(p === 'look-hand' ? 'feuille' : evening && (p === 'sip' || p === 'talk' || p === 'shy') && finaleStage < 2 ? 'gobelet' : null)
        anim.update(dt)
        const far = Math.hypot(heroLocal.x - pos.x, heroLocal.z - pos.z)
        model.glow.scale.multiplyScalar(1 + 2.2 * Math.min(1, Math.max(0, (far - 8) / 25)))
      }
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
