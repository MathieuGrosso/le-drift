import * as THREE from 'three'
import type { GameContext, HeroMode, Medium, System, SystemId, Vec3 } from '../core/types'
import { createMat, type MatFn } from './mats'
import { canvas2d, type Canvas2D } from './paint'
import {
  campSign, goatModel, paintAntigaspi, paintAtlas, paintAvis, paintCommande, paintComptage, paintCreneaux,
  paintGreffier, paintJus, paintMercuriale, paintPatee, paintRetro, plafondModel, poster, remise, sanctuary, scanGhost,
} from './props'
import { Rebot } from './rebot'
import { ATLAS, BRIBES, CAMP, CHEVRE, GREFFIER, JUS, OURS, PLAFOND, POSTERS, PROMPTS, REBOT, SCAN, SPEAKER, type Line } from './text'
import { EggUi } from './ui'
import { quarterPoint } from '../core/layout'

interface Spot {
  id: string
  medium: Medium
  reach: number
  dyMax?: number
  pos(): Vec3
  label: string
  active?(): boolean
  run(): Promise<void>
}

interface Plafond {
  id: keyof typeof PLAFOND.objets
  obj: THREE.Group
  base: Vec3
}

const BUSY_MODES: ReadonlySet<HeroMode> = new Set<HeroMode>(['cutscene', 'sleep', 'airlock', 'sit', 'lean', 'ladder', 'exhausted'])
const GP_OVERLAYS = '.gp-dialogue.show, .gp-narrate, .gp-credits, .gp-clap'
const ARM_S = 0.3
const quarterVec = (x: number, y: number, z: number) => {
  const p = quarterPoint({ x, y, z })
  return new THREE.Vector3(p.x, p.y, p.z)
}
const REBOT_AT = quarterPoint({ x: 25.25, y: 0, z: 58.55 })
const REMISE_AT = quarterPoint({ x: -6, y: 3.7, z: 57.8 })
const SANCTUAIRE_AT = quarterPoint({ x: 18, y: 7.9, z: 64 })
const CAMP_AT = quarterPoint({ x: -11, y: 3.65, z: 62 })
const ROOFS_CENTER = quarterPoint({ x: 6, y: 5, z: 63 })
const ROOFS_VIEW = 72
const PLAFOND_AT: Record<Exclude<keyof typeof PLAFOND.objets, 'disquette'>, Vec3> = {
  scanette: quarterPoint({ x: 2.5, y: 2.75, z: 62.2 }),
  gobelet: quarterPoint({ x: 23, y: 3.5, z: 63.5 }),
  etiquette: quarterPoint({ x: -16, y: 2.45, z: 62 }),
  colis: quarterPoint({ x: -4.0, y: 2.75, z: 59.9 }),
  stylo: quarterPoint({ x: -22.5, y: 2.45, z: 57.5 }),
  casque: quarterPoint({ x: 33.5, y: 2.45, z: 62 }),
  bonnet: quarterPoint({ x: 2.2, y: 3.5, z: 72.5 }),
}

export function createEggsSystem(): System {
  let ctxRef: GameContext | null = null
  let ui: EggUi | null = null
  let rebot: Rebot | null = null
  const inside = new THREE.Group()
  inside.name = 'eggs-interieur'
  const roofs = new THREE.Group()
  roofs.name = 'eggs-toits'
  const spots: Spot[] = []
  const plafonds: Plafond[] = []
  const offs: (() => void)[] = []
  const heroLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  let gpHint = false
  let armed = 0
  let current: Spot | null = null
  let time = 0
  let rebotTalks = 0
  let rebotLine = 0
  let greffierIdx = 0
  let atlasIdx = 0
  let atlasAnswer: string | null = null
  let lastDay = -1
  let lastHour = -1
  let bribeTimer = 1
  let bribeCooldown = 0
  const bribesSeen = new Set<string>()
  let ghost: { root: THREE.Group; card: THREE.Sprite; leaving: number } | null = null
  let marketGoat: THREE.Object3D | null = null
  let shrineGoat: THREE.Group | null = null
  let shrineLight: THREE.Sprite | null = null
  let creneaux: Canvas2D | null = null
  let mercuriale: Canvas2D | null = null
  let avis: Canvas2D | null = null
  let greffier: Canvas2D | null = null
  let atlas: Canvas2D | null = null

  const flag = (id: string) => !!ctxRef?.state.flags[`oeuf:${id}`]
  const setFlag = (id: string) => {
    if (ctxRef) ctxRef.state.flags[`oeuf:${id}`] = true
  }
  const sfx = (id: string, at?: Vec3) => {
    try {
      ctxRef?.services.audio?.sfx(id, at)
    } catch {
      /* audio is optional */
    }
  }

  const talk = async (lines: readonly Line[]) => {
    const ctx = ctxRef
    if (!ctx || !ui) return
    const hero = ctx.services.hero
    const prev = ctx.state.hero.mode
    if (hero) hero.setMode('cutscene')
    else ctx.state.hero.mode = 'cutscene'
    try {
      await ui.say(lines)
    } finally {
      const back = prev === 'swim' ? 'swim' : 'idle'
      if (hero) hero.setMode(back)
      else ctx.state.hero.mode = back
      armed = 0
    }
  }

  const add = (s: Spot) => spots.push(s)

  const buildInterior = (ctx: GameContext, mat: MatFn) => {
    rebot = new Rebot(mat, REBOT_AT)
    rebot.wearsHat = flag('rebot-bonnet')
    inside.add(rebot.root)

    inside.add(poster(mat, paintCommande(), 3.0, 1.5, quarterPoint({ x: 21.5, y: 2.9, z: 56.13 }), 0))
    const jus = canvas2d(256, 320)
    paintJus(jus)
    inside.add(poster(mat, jus, 0.8, 1.0, quarterPoint({ x: -10.2, y: 1.4, z: 60.94 }), 0))
    inside.add(poster(mat, paintComptage(), 0.64, 0.8, quarterPoint({ x: 3.3, y: 1.4, z: 63.06 }), Math.PI))
    inside.add(poster(mat, paintAntigaspi(), 0.64, 0.8, quarterPoint({ x: 17.87, y: 1.5, z: 52.0 }), -Math.PI / 2))
    creneaux = canvas2d(256, 256)
    paintCreneaux(creneaux, ctx.state.time.hours)
    inside.add(poster(mat, creneaux, 0.8, 0.8, quarterPoint({ x: 10.13, y: 1.5, z: 49.6 }), Math.PI / 2, 0x5a3a26))
    mercuriale = canvas2d(384, 384)
    paintMercuriale(mercuriale, ctx.state.time.day)
    lastDay = ctx.state.time.day
    inside.add(poster(mat, mercuriale, 1.4, 1.4, quarterPoint({ x: -31.6, y: 1.9, z: 54.13 }), 0, 0x5a3a26))
    inside.add(poster(mat, paintPatee(), 0.9, 0.56, quarterPoint({ x: -28.2, y: 2.2, z: 54.13 }), 0, 0x6b4a22))
    avis = canvas2d(256, 320)
    paintAvis(avis, flag('chevre-or'))
    inside.add(poster(mat, avis, 0.64, 0.8, quarterPoint({ x: -39.87, y: 1.75, z: 61.0 }), Math.PI / 2))
    inside.add(poster(mat, paintRetro(), 1.0, 0.8, quarterPoint({ x: -3.13, y: 1.45, z: 59.6 }), -Math.PI / 2))

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.6), mat({ color: 0x8a5a3b, indoor: true }))
    shelf.position.copy(quarterVec(-39.78, 1.18, 61.0))
    inside.add(shelf)
    const g = goatModel(mat, 0xf2c14e, 0x4a3410, true)
    g.scale.setScalar(0.5)
    g.position.copy(quarterVec(-39.78, 1.2, 61.0))
    g.rotation.y = Math.PI / 2
    g.visible = flag('chevre-or')
    inside.add(g)
    marketGoat = g

    greffier = canvas2d(320, 128)
    paintGreffier(greffier, GREFFIER.noms[0]!)
    inside.add(poster(mat, greffier, 0.75, 0.3, quarterPoint({ x: 28.3, y: 1.4, z: 61.13 }), 0, 0x7a5a1e))

    atlas = canvas2d(320, 200)
    paintAtlas(atlas, true, null)
    inside.add(poster(mat, atlas, 0.72, 0.45, quarterPoint({ x: -11.5, y: 1.4, z: 56.63 }), 0, 0x2a2f3a))

    if (!flag('scan')) {
      const s = scanGhost()
      s.root.position.copy(quarterVec(-20.5, 1.45, 62))
      inside.add(s.root)
      ghost = { ...s, leaving: 0 }
    }

    const r = remise(mat, REMISE_AT)
    roofs.add(r.root)

    add({
      id: 'rebot', medium: 'air', reach: 1.9, label: PROMPTS.parler,
      pos: () => ({ x: REBOT_AT.x, y: 0.5, z: REBOT_AT.z }),
      run: () => talkRebot(),
    })
    add({
      id: 'jus', medium: 'air', reach: 1.8, label: PROMPTS.lire,
      pos: () => quarterPoint({ x: -10.2, y: 1.0, z: 61.3 }),
      run: () => {
        const h = ctx.state.hero
        const ratio = h.breathMax > 0 ? h.breath / h.breathMax : 1
        const pression = Math.max(1, Math.min(5, 1 + Math.round((1 - ratio) * 4)))
        return talk(JUS.reponses(pression, h.wetness > 0.2))
      },
    })
    add({
      id: 'comptage', medium: 'air', reach: 1.6, label: PROMPTS.lire,
      pos: () => quarterPoint({ x: 3.3, y: 1.0, z: 62.7 }),
      run: () => talk([[null, `${POSTERS.comptage.titre}. ${POSTERS.comptage.lignes.join(' ')}`]]),
    })
    add({
      id: 'greffier', medium: 'air', reach: 1.8, label: PROMPTS.lire,
      pos: () => quarterPoint({ x: 28.3, y: 1.0, z: 61.5 }),
      run: async () => {
        const n = GREFFIER.noms
        const from = n[greffierIdx]!
        greffierIdx = (greffierIdx + 1) % n.length
        const lines: Line[] = [GREFFIER.juge(from), GREFFIER.propose(n[greffierIdx]!)]
        await talk(lines)
        if (greffier) paintGreffier(greffier, n[greffierIdx]!)
        if (greffierIdx === 0) await talk([GREFFIER.boucle])
      },
    })
    add({
      id: 'atlas', medium: 'air', reach: 1.8, label: PROMPTS.interroger,
      pos: () => quarterPoint({ x: -11.5, y: 1.0, z: 57.0 }),
      run: async () => {
        const qs = [...ATLAS.questions, flag('chevre-or') ? ATLAS.chevreOk : ATLAS.chevre]
        const [q, a] = qs[atlasIdx % qs.length]!
        const lines: Line[] = atlasIdx === 0 ? [ATLAS.accueil] : []
        atlasIdx++
        lines.push(['Ilo', q], [SPEAKER.atlas, a])
        atlasAnswer = a
        await talk(lines)
      },
    })
    add({
      id: 'scan', medium: 'air', reach: 1.8, label: PROMPTS.aider,
      pos: () => quarterPoint({ x: -20.5, y: 1.0, z: 62 }),
      active: () => !flag('scan'),
      run: async () => {
        await talk(SCAN.bip)
        setFlag('scan')
        if (ghost) ghost.leaving = 0.001
        sfx('trouvaille')
        ui?.toast(SPEAKER.scan, SCAN.rentre)
      },
    })
    add({
      id: 'ours', medium: 'water', reach: 2.2, label: PROMPTS.regarder,
      pos: () => r.ours,
      run: () => talk(OURS),
    })
    const disquette = plafondModel(mat, 'disquette')
    disquette.position.set(r.plafond.x, r.plafond.y, r.plafond.z)
    roofs.add(disquette)
    plafonds.push({ id: 'disquette', obj: disquette, base: r.plafond })

    const sanc = sanctuary(mat, SANCTUAIRE_AT)
    roofs.add(sanc.root)
    shrineGoat = sanc.goat
    shrineLight = sanc.light
    add({
      id: 'chevre-or', medium: 'water', reach: 2.4, label: PROMPTS.regarder,
      pos: () => ({ x: SANCTUAIRE_AT.x, y: SANCTUAIRE_AT.y + 1.0, z: SANCTUAIRE_AT.z - 0.4 }),
      run: async () => {
        if (flag('chevre-or')) return talk(CHEVRE.deja)
        await talk(CHEVRE.rencontre)
        setFlag('chevre-or')
        if (avis) paintAvis(avis, true)
        if (marketGoat) marketGoat.visible = true
        sfx('trouvaille')
        ctx.services.audio?.cue('wonder')
        ui?.toast('Sanctuaire', CHEVRE.trouvee)
      },
    })

    const camp = campSign(mat, CAMP_AT)
    camp.scale.setScalar(0.8)
    roofs.add(camp)
    add({
      id: 'camp', medium: 'water', reach: 2.2, label: PROMPTS.lire,
      pos: () => ({ x: CAMP_AT.x, y: CAMP_AT.y + 1.0, z: CAMP_AT.z }),
      run: () => talk(CAMP),
    })

    for (const [id, at] of Object.entries(PLAFOND_AT) as [Plafond['id'], Vec3][]) {
      const obj = plafondModel(mat, id)
      obj.position.set(at.x, at.y, at.z)
      const parent = id === 'bonnet' ? roofs : inside
      parent.add(obj)
      plafonds.push({ id, obj, base: at })
    }
    for (const p of plafonds) {
      if (flag(`plafond:${p.id}`)) p.obj.visible = false
      const water = p.id === 'disquette' || p.id === 'bonnet'
      add({
        id: `plafond:${p.id}`, medium: water ? 'water' : 'air', reach: water ? 2.4 : 1.3, dyMax: water ? 2.2 : 3.2,
        label: water ? PROMPTS.ramasser : PROMPTS.decrocher,
        pos: () => p.base,
        active: () => !flag(`plafond:${p.id}`),
        run: async () => pickPlafond(p),
      })
    }
  }

  const pickPlafond = async (p: Plafond) => {
    const ctx = ctxRef
    if (!ctx || !ui) return
    setFlag(`plafond:${p.id}`)
    p.obj.visible = false
    sfx('trouvaille', ctx.state.hero.position)
    const total = plafonds.length
    const n = plafonds.filter((q) => flag(`plafond:${q.id}`)).length
    const o = PLAFOND.objets[p.id]
    ui.toast(`${PLAFOND.titre} ${PLAFOND.compte(n, total)}`, o.nom, o.note)
    if (n === total && !flag('plafond-complet')) {
      setFlag('plafond-complet')
      window.setTimeout(() => ui?.toast(PLAFOND.titre, PLAFOND.complet), 5200)
    }
  }

  const talkRebot = async () => {
    const ctx = ctxRef
    if (!ctx || !rebot) return
    const hours = ctx.state.time.hours
    const pose = rebot.pose
    if (pose === 'dort') return talk([[SPEAKER.rebot, REBOT.dort]])
    rebotTalks++
    if (flag('plafond:bonnet') && !flag('rebot-bonnet')) {
      setFlag('rebot-bonnet')
      rebot.wearsHat = true
      rebot.danse()
      return talk([[SPEAKER.rebot, REBOT.bonnet], [null, REBOT.bonnetMerci]])
    }
    if (rebotTalks % 6 === 0) {
      rebot.sautille()
      return talk([[SPEAKER.rebot, REBOT.sixSept]])
    }
    rebot.danse()
    if (pose === 'assis') return talk([[SPEAKER.rebot, REBOT.assis]])
    const key = `rebot-cafe-${ctx.state.time.day}`
    if (hours >= 6 && hours < 11 && !ctx.state.flags[key]) {
      ctx.state.flags[key] = true
      return talk([[SPEAKER.rebot, REBOT.cafe]])
    }
    const pool = [...REBOT.bonjour, flag('chevre-or') ? REBOT.chevreTrouvee : REBOT.chevrePerdue]
    const line = pool[rebotLine % pool.length]!
    rebotLine++
    const lines: Line[] = [[SPEAKER.rebot, line]]
    if (rebotLine % 3 === 0) lines.push([SPEAKER.rebot, REBOT.apresDanse])
    return talk(lines)
  }

  const blocked = (ctx: GameContext) =>
    !ui || ui.talking() || gpHint || BUSY_MODES.has(ctx.state.hero.mode) || document.querySelector(GP_OVERLAYS) !== null

  const pickSpot = (ctx: GameContext): Spot | null => {
    const h = ctx.state.hero
    let best: Spot | null = null
    let bestD = Infinity
    for (const s of spots) {
      if (s.medium !== h.medium) continue
      if (s.active && !s.active()) continue
      const p = s.pos()
      const ref = heroLocal
      const dy = Math.abs(ref.y + 0.8 - p.y)
      const d = Math.hypot(ref.x - p.x, ref.z - p.z)
      if (d > s.reach || dy > (s.dyMax ?? 2.2) || d >= bestD) continue
      best = s
      bestD = d
    }
    return best
  }

  const animate = (ctx: GameContext, dt: number) => {
    const st = ctx.state
    const drift = ctx.services.drift
    rebot?.update(dt, drift ? heroLocal : null, st.time.hours, new Date().getMonth() === 11)
    if (ghost) {
      const r = ghost.root
      if (ghost.leaving > 0) {
        ghost.leaving += dt
        r.position.x -= dt * 3
        r.position.y += dt * 0.4
        r.scale.setScalar(Math.max(0.01, 1 - ghost.leaving / 2))
        if (ghost.leaving > 2) {
          r.removeFromParent()
          ghost = null
        }
      } else {
        r.position.y = 1.45 + Math.sin(time * 2.2) * 0.08
        r.position.x = -20.5 + Math.sin(time * 0.7) * 0.4
        ghost.card.material.opacity = Math.sin(time * 9) > -0.2 ? 1 : 0.35
      }
    }
    if (shrineGoat && shrineLight) {
      shrineGoat.rotation.y = Math.PI / 2 + Math.sin(time * 0.4) * 0.25
      shrineLight.material.opacity = 0.6 + 0.3 * Math.sin(time * 1.3)
    }
    for (const p of plafonds) {
      if (!p.obj.visible) continue
      p.obj.position.y = p.base.y + Math.sin(time * 1.1 + p.base.x) * 0.06
      p.obj.rotation.y += dt * 0.6
    }
    if (atlas && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) paintAtlas(atlas, Math.floor(time * 2) % 2 === 0, atlasAnswer)
  }

  const bribes = (ctx: GameContext, dt: number) => {
    bribeCooldown -= dt
    bribeTimer -= dt
    if (bribeTimer > 0 || bribeCooldown > 0 || !ui || ui.talking()) return
    bribeTimer = 1
    const drift = ctx.services.drift
    const h = ctx.state.hero
    if (!drift || h.medium !== 'air') return
    for (const [id, list] of Object.entries(BRIBES)) {
      const key = `${ctx.state.time.day}:${id}`
      if (bribesSeen.has(key)) continue
      const p = drift.npcPosition(id)
      if (!p || Math.hypot(p.x - h.position.x, p.z - h.position.z) > 3.2) continue
      bribesSeen.add(key)
      if (Math.random() > 0.35) continue
      const lift = id === 'mila' || id === 'tao' || id === 'pepin' ? 1.75 : 2.45
      const line = list[Math.floor(Math.random() * list.length)]!
      ui.speak(() => {
        const q = drift.npcPosition(id)
        return q ? { x: q.x, y: q.y + lift, z: q.z } : null
      }, line)
      bribeCooldown = 25
      return
    }
  }

  return {
    id: 'eggs' as string as SystemId,
    init(ctx) {
      ctxRef = ctx
      const mat = createMat(ctx)
      ui = new EggUi(ctx)
      const driftRoot = ctx.scene.getObjectByName('le-drift')
      if (driftRoot) {
        driftRoot.add(inside, roofs)
        buildInterior(ctx, mat)
      }
      lastHour = Math.floor(ctx.state.time.hours)

      offs.push(ctx.bus.on('interact:hint', (h) => {
        gpHint = h !== null
      }))
      offs.push(ctx.bus.on('game:paused', ({ paused }) => {
        if (paused) ui?.showPrompt(null)
      }))
      offs.push(ctx.bus.on('quest:completed', () => rebot?.danse()))
      offs.push(ctx.bus.on('time:hour', ({ hour, day }) => {
        if (creneaux && hour !== lastHour) paintCreneaux(creneaux, hour)
        lastHour = hour
        if (mercuriale && day !== lastDay) paintMercuriale(mercuriale, day)
        lastDay = day
      }))
    },

    update(dt, ctx) {
      time += dt
      ui?.update(dt)
      const drift = ctx.services.drift
      if (drift) {
        const l = drift.toLocal(ctx.state.hero.position)
        heroLocal.x = l.x
        heroLocal.y = l.y
        heroLocal.z = l.z
      }
      if (drift) {
        const env = drift.cameraEnv?.()
        inside.visible = env ? env.indoor > 0 : true
        const c = drift.toLocal(ctx.camera.position)
        roofs.visible = Math.hypot(c.x - ROOFS_CENTER.x, c.y - ROOFS_CENTER.y, c.z - ROOFS_CENTER.z) < ROOFS_VIEW
      }
      animate(ctx, dt)
      bribes(ctx, dt)

      if (blocked(ctx)) {
        armed = 0
        if (current) {
          current = null
          ui?.showPrompt(null)
        }
        return
      }
      armed += dt
      const spot = pickSpot(ctx)
      if (spot !== current) {
        current = spot
        ui?.showPrompt(spot ? spot.label : null)
      }
      if (spot && armed > ARM_S && ctx.input.pressed('interact')) {
        current = null
        ui?.showPrompt(null)
        void spot.run()
      }
    },

    dispose() {
      for (const off of offs.splice(0)) off()
      inside.removeFromParent()
      roofs.removeFromParent()
      ui?.dispose()
      ui = null
      ctxRef = null
    },
  }
}
