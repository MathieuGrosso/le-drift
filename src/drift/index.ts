import * as THREE from 'three'
import { DISTRICT_BY_ID, DISTRICT_NEIGHBOURS, PLACES, districtAt, inDistrict } from '../core/layout'
import type { CameraEnv, CellId, DistrictId, DriftService, GameContext, LockId, Medium, RoomId, System, Vec3 } from '../core/types'
import { ForecastBoard } from './board'
import { ChartTable } from './chart'
import { Chatter } from './chatter'
import { dirToWorld, toLocal, toWorld, yawToWorld, type DriftPose } from './frame'
import { Hulls } from './hulls'
import { LOCK_OUTSIDE, PORTHOLES, RECT_WINDOWS, partById } from './interiors/layout'
import { Quarter, type LockId as QuarterLock } from './interiors/quarter'
import { createMats, type Mats } from './materials'
import { Nef } from './nef'
import { Npcs } from './npcs'
import { PAL } from './palette'
import { registerDriftPoses } from './poses'
import { METERS_PER_GAME_HOUR, currentGate, minimumProgressForAct, poseAt } from './route'
import { gratingTexture, drawingsTexture, planksTexture } from './textures'
import { Windows } from './windows'

const SPAWNS: Record<RoomId, { x: number; y: number; z: number; yaw: number }> = {
  sas: { x: 0, y: 0, z: 66.4, yaw: Math.PI },
  'coursive-sud': { x: -4, y: 0, z: 62, yaw: Math.PI / 2 },
  refectoire: { x: 18, y: 0, z: 57.9, yaw: Math.PI },
  rebord: { x: 18, y: 0.6, z: 70.2, yaw: Math.PI },
  cuisine: { x: 13.5, y: 0, z: 54.6, yaw: 0 },
  marche: { x: -31, y: 0, z: 62, yaw: -Math.PI / 2 },
  'passerelle-1': { x: -20, y: 0, z: 62, yaw: -Math.PI / 2 },
  'passerelle-2': { x: 31, y: 0, z: 62, yaw: Math.PI / 2 },
  'passerelle-3': { x: -17, y: 0, z: 57.5, yaw: -Math.PI / 2 },
  'salle-des-cartes': { x: 40, y: 0, z: 64.4, yaw: 0 },
  cabine: { x: -6.6, y: 0, z: 65.4, yaw: 0 },
  'cabines-voisins': { x: -6, y: 0, z: 59.6, yaw: 0 },
  'echelle-toit': { x: -2.35, y: 3.05, z: 64.6, yaw: Math.PI / 2 },
}

const LOCK_ANCHORS: Record<'sas' | 'echelle-toit', Vec3> = {
  sas: LOCK_OUTSIDE,
  'echelle-toit': { x: -2.3, y: 6.6, z: 64.6 },
}
const ATRIUM_AIR: Partial<Record<RoomId, number>> = { refectoire: 0.15, marche: 0.2 }

function glassPoints(): Map<RoomId, Vec3[]> {
  const out = new Map<RoomId, Vec3[]>()
  const at = (partId: string, side: string, a: number, y: number): Vec3 => {
    const p = partById(partId)
    if (side === 'n') return { x: a, y: p.floorY + y, z: p.z0 }
    if (side === 's') return { x: a, y: p.floorY + y, z: p.z1 }
    if (side === 'w') return { x: p.x0, y: p.floorY + y, z: a }
    return { x: p.x1, y: p.floorY + y, z: a }
  }
  const push = (partId: string, v: Vec3) => {
    const room = partById(partId).room
    const list = out.get(room) ?? []
    list.push(v)
    out.set(room, list)
  }
  for (const h of PORTHOLES) push(h.part, at(h.part, h.side, h.at, h.y))
  for (const w of RECT_WINDOWS) {
    for (const k of [-0.4, 0, 0.4]) push(w.part, at(w.part, w.side, w.at + k * w.w, w.y0 + w.h / 2))
  }
  return out
}

const GUIDE_ROPE: readonly [number, number, number][] = [
  [0.7, 0.4, 73.7], [3.5, -0.2, 74.6], [8, 0.1, 73.4], [12.4, 0.6, 72.4], [23.6, 0.6, 72.4],
  [27, -0.3, 70.5], [33, 0.1, 68.4], [38.2, 0.5, 67.4], [42, 0.4, 67.4],
]

export function createDriftSystem(): System {
  const pose: DriftPose = { position: { x: 0, y: 0, z: 0 }, heading: 0, velocity: { x: 0, y: 0, z: 0 } }
  const root = new THREE.Group()
  root.name = 'le-drift'
  let mats: Mats
  let hulls: Hulls | null = null
  let nef: Nef | null = null
  let district: DistrictId = 'ecluse'
  let loadedKey = ''
  const loaded = new Set<DistrictId>()
  const glass = glassPoints()
  const camEnv: CameraEnv = { indoor: 1, glassDist: 4, airHaze: 0, district: 'ecluse', cell: 'cabine' }
  let quarter: Quarter | null = null
  let windows: Windows | null = null
  let npcs: Npcs | null = null
  let board: ForecastBoard | null = null
  let chart: ChartTable | null = null
  let chatter: Chatter | null = null
  let ctxRef: GameContext | null = null
  let lastProgress = 0
  let lastRoom: RoomId | null | undefined
  let creakIn = 10
  let groanCooldown = 0
  let lastHeading = 0
  const fallbackLights: THREE.PointLight[] = []
  const offs: (() => void)[] = []
  const heroLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  const camLocal: Vec3 = { x: 0, y: -1000, z: 0 }
  const tmp: Vec3 = { x: 0, y: 0, z: 0 }

  const syncPose = (ctx: GameContext) => {
    const st = ctx.state
    const gate = currentGate(st)
    st.drift.progress = Math.min(gate.distance, Math.max(st.drift.progress, minimumProgressForAct(st)))
    const moving = st.drift.progress < gate.distance - 1e-3
    poseAt(st.drift.progress, moving, st.time.scale, pose)
    st.drift.position = { ...pose.position }
    st.drift.heading = pose.heading
    st.drift.velocity = { ...pose.velocity }
    st.drift.gate = gate.id
    root.position.set(pose.position.x, pose.position.y, pose.position.z)
    root.rotation.set(0, -pose.heading, 0)
    root.updateMatrixWorld(true)
  }

  const heroPlace = (ctx: GameContext) => (local: Vec3) => {
    const w = toWorld(pose, local)
    const hero = ctx.services.hero
    if (hero) hero.teleport(w, ctx.state.hero.yaw)
  }

  const sfx = (ctx: GameContext, id: string, at?: Vec3) => {
    try {
      ctx.services.audio?.sfx(id, at)
    } catch {
      /* audio is optional */
    }
  }

  const service: DriftService = {
    pose: () => ({ position: { ...pose.position }, heading: pose.heading, velocity: { ...pose.velocity } }),
    lockPosition: () => toWorld(pose, LOCK_OUTSIDE),
    nearestWindow: (p, maxDist) => windows?.nearest(pose, p, maxDist) ?? null,
    scrub: (id, amount) => windows?.scrub(id, amount) ?? 0,
    npcPosition: (id) => {
      const l = npcs?.position(id)
      return l ? toWorld(pose, l) : null
    },
    playScene: (id) => npcs?.playScene(id) ?? Promise.resolve(),
    mediumAt: (p): Medium => {
      const l = toLocal(pose, p, tmp)
      if (nef?.contains(l)) return 'air'
      return quarter ? quarter.mediumAt(l) : 'water'
    },
    roomAt: (p) => (quarter ? quarter.roomAt(toLocal(pose, p, tmp)) : null),
    toLocal: (p) => toLocal(pose, p),
    toWorld: (p) => toWorld(pose, p),
    roomSpawn: (room) => {
      const s = SPAWNS[room]
      return { position: toWorld(pose, s), yaw: yawToWorld(pose, s.yaw) }
    },
    ladders: (room) =>
      (quarter?.furniture.ladders ?? [])
        .filter((l) => l.rooms.includes(room))
        .map((l) => ({ id: l.id, bottom: toWorld(pose, l.bottom), top: toWorld(pose, l.top), normal: dirToWorld(pose, l.normal) })),
    seat: (id) => {
      const s = quarter?.furniture.seats.find((q) => q.id === id)
      if (!s) return null
      return { position: toWorld(pose, s), yaw: yawToWorld(pose, s.yaw) }
    },
    openDoor: (id, open) => quarter?.openDoor(id, open),
    cycleAirlock: (lockId: QuarterLock, dir) => {
      const ctx = ctxRef
      if (!quarter || !ctx) return Promise.resolve()
      return quarter.cycleAirlock(lockId, dir, heroPlace(ctx), () => toLocal(pose, ctx.state.hero.position))
    },
    roomCeilingAt: (p) => {
      const l = toLocal(pose, p, tmp)
      const y = quarter?.ceilingAt(l) ?? nef?.ceilingAt(l) ?? null
      return y === null ? null : y + pose.position.y
    },
    lockAnchor: (lockId: LockId) => {
      const a = lockId === 'sas' || lockId === 'echelle-toit' ? LOCK_ANCHORS[lockId] : null
      return a ? toWorld(pose, a) : null
    },
    districtAt: (local) => districtAt(local),
    cellAt: (local): CellId | null => quarter?.roomAt(local) ?? nef?.cellAt(local) ?? null,
    cellSpawn: (cell) => {
      const s = (SPAWNS as Record<string, { x: number; y: number; z: number; yaw: number }>)[cell]
      if (s) return { local: { x: s.x, y: s.y, z: s.z }, yaw: s.yaw }
      const place = PLACES[cell]
      return place && place.mode === 'inside' ? { local: { ...place.local }, yaw: place.yaw } : null
    },
    loadedDistricts: () => [...loaded],
    cameraEnv: () => camEnv,
  }

  const updateCameraEnv = (st: GameContext['state']) => {
    const room = quarter?.roomAt(camLocal) ?? null
    const nefCell = room ? null : nef?.cellAt(camLocal) ?? null
    camEnv.district = districtAt(camLocal)
    camEnv.cell = room ?? nefCell
    if (room && quarter?.mediumAt(camLocal) === 'air') {
      camEnv.indoor = 1
      camEnv.airHaze = ATRIUM_AIR[room] ?? 0
      let best = 30
      for (const g of glass.get(room) ?? []) best = Math.min(best, Math.hypot(g.x - camLocal.x, g.y - camLocal.y, g.z - camLocal.z))
      camEnv.glassDist = Math.max(0.5, best)
    } else if (nefCell) {
      camEnv.indoor = 1
      camEnv.airHaze = 1
      camEnv.glassDist = 140
    } else {
      const heroInside = st.mode === 'inside' && st.hero.medium === 'air' && !st.debug.cameraLocked
      camEnv.indoor = heroInside ? 1 : 0
      camEnv.airHaze = 0
      camEnv.glassDist = heroInside ? 4 : 0
    }
  }

  const levelLoad = (ctx: GameContext): number => {
    const q = ctx.quality.level
    return q === 'high' ? 99 : q === 'medium' ? 2 : 1
  }

  const updateStreaming = (ctx: GameContext) => {
    const st = ctx.state
    const ref = st.mode === 'inside' && st.hero.localPosition ? st.hero.localPosition : heroLocal
    const here = districtAt(ref)
    if (here !== district && !inDistrict(DISTRICT_BY_ID[district], ref, 20)) {
      const from = district
      district = here
      st.hero.district = here
      ctx.bus.emit('district:entered', { district: here, from })
    } else if (here !== district && st.hero.district !== district) st.hero.district = district
    loaded.clear()
    loaded.add(district)
    for (const n of DISTRICT_NEIGHBOURS[district].slice(0, levelLoad(ctx))) loaded.add(n)
    const key = [...loaded].sort().join(',')
    if (key !== loadedKey) {
      loadedKey = key
      hulls?.setLoaded(loaded)
      ctx.bus.emit('district:streamed', { loaded: [...loaded] })
    }
    const smallRoom = camEnv.indoor > 0.5 && camEnv.airHaze < 0.5 && camEnv.cell !== null
    hulls?.setVisible(smallRoom && ctx.quality.level !== 'high' ? loaded : null)
  }

  return {
    id: 'drift',
    init(ctx) {
      ctxRef = ctx
      mats = createMats(ctx)
      syncPose(ctx)
      lastProgress = ctx.state.drift.progress
      lastHeading = pose.heading
      ctx.scene.add(root)

      board = new ForecastBoard()
      board.draw(ctx.state.env, ctx.state.time.day)
      chart = new ChartTable()
      const textures = {
        floors: { bois: planksTexture(), tapis: planksTexture(), metal: gratingTexture() },
        board: board.texture,
        chart: chart.texture,
        drawings: drawingsTexture(),
      }

      try {
        hulls = new Hulls(ctx, mats, root, pose)
      } catch (err) {
        console.error('[drift] hulls', err)
      }
      quarter = new Quarter(ctx, mats, textures, pose)
      root.add(quarter.root)
      try {
        nef = new Nef(ctx, mats, root, pose)
      } catch (err) {
        console.error('[drift] nef', err)
      }
      district = ctx.state.hero.localPosition ? districtAt(ctx.state.hero.localPosition) : ctx.state.hero.district
      windows = new Windows(ctx, mats, quarter, quarter.root)
      npcs = new Npcs(ctx, mats, quarter)
      quarter.root.add(npcs.group)
      chatter = new Chatter(ctx)

      const curve = new THREE.CatmullRomCurve3(GUIDE_ROPE.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
      const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.035, 5), mats.cel({ color: PAL.corde }))
      rope.name = 'corde-guide'
      root.add(rope)

      if (mats.fallback) {
        ctx.scene.add(new THREE.HemisphereLight(0xcfefe3, 0x3e3a5a, 1.1))
        const sun = new THREE.DirectionalLight(0xfff1c9, 1.2)
        sun.position.set(40, 120, 30)
        ctx.scene.add(sun)
        for (let i = 0; i < 4; i++) {
          const l = new THREE.PointLight(PAL.lampe, 0, 7, 1.6)
          ctx.scene.add(l)
          fallbackLights.push(l)
        }
      }

      registerDriftPoses(ctx, () => pose)
      ctx.services.drift = service

      offs.push(ctx.bus.on('sleep:done', ({ fromHour, toHour }) => {
        const hours = (((toHour - fromHour) % 24) + 24) % 24
        ctx.state.drift.progress += hours * METERS_PER_GAME_HOUR
      }))
      offs.push(ctx.bus.on('weather:changed', ({ env }) => board?.draw(env, ctx.state.time.day)))
      offs.push(ctx.bus.on('time:hour', ({ day }) => board?.draw(ctx.state.env, day)))
      offs.push(ctx.bus.on('act:changed', () => board?.draw(ctx.state.env, ctx.state.time.day)))
    },

    update(dt, ctx) {
      if (!quarter) return
      const st = ctx.state
      st.drift.progress += METERS_PER_GAME_HOUR * st.time.scale * dt
      syncPose(ctx)
      const jumped = Math.abs(st.drift.progress - lastProgress) > 5
      lastProgress = st.drift.progress

      toLocal(pose, st.hero.position, heroLocal)
      const cp = ctx.camera.position
      toLocal(pose, { x: cp.x, y: cp.y, z: cp.z }, camLocal)

      updateCameraEnv(st)
      hulls?.update(dt, pose, jumped)
      quarter.update(dt, pose, heroLocal, camLocal, jumped)
      nef?.update(pose, jumped)
      if (nef && camEnv.cell?.startsWith('nef')) nef.writeLamps({ x: cp.x, y: cp.y, z: cp.z })
      updateStreaming(ctx)
      windows?.update(dt)
      npcs?.update(dt)
      chart?.update(dt, ctx, quarter.isDetailVisible('salle-des-cartes'))

      const room = quarter.roomAt(heroLocal)
      if (room !== lastRoom) {
        if (lastRoom) ctx.bus.emit('room:left', { roomId: lastRoom })
        if (room) ctx.bus.emit('room:entered', { roomId: room })
        lastRoom = room
      }

      const indoor = room !== null
      creakIn -= dt
      groanCooldown -= dt
      if (indoor && creakIn <= 0) {
        creakIn = 8 + Math.random() * 12
        sfx(ctx, 'creak', st.hero.position)
      }
      let dh = pose.heading - lastHeading
      dh = Math.atan2(Math.sin(dh), Math.cos(dh))
      lastHeading = pose.heading
      if (indoor && dt > 0 && Math.abs(dh / dt) > 0.003 && groanCooldown <= 0) {
        groanCooldown = 25
        sfx(ctx, 'hull-groan', st.hero.position)
      }

      if (chatter && npcs) {
        const near = indoor
          ? npcs.nearby(new THREE.Vector3(heroLocal.x, heroLocal.y, heroLocal.z), 3.5).map((n) => ({
              id: n.id,
              key: n.key,
              world: new THREE.Vector3().copy(toWorld(pose, n.pos)),
              height: n.id === 'mila' || n.id === 'tao' || n.id === 'pepin' ? 1.25 : 1.95,
            }))
          : []
        chatter.update(dt, indoor, near, (windows?.coat('grande-vitre') ?? 0) > 0.55)
      }

      if (fallbackLights.length > 0) {
        const lamps = quarter.nearestLamps(st.hero.position, fallbackLights.length)
        fallbackLights.forEach((l, i) => {
          const src = lamps[i]
          l.intensity = src && indoor ? 6 : 0
          if (src) {
            l.position.copy(src.position)
            l.color.copy(src.color)
          }
        })
      }
    },

    dispose() {
      for (const off of offs.splice(0)) off()
      chatter?.dispose()
      npcs?.dispose()
      quarter?.dispose()
      hulls?.dispose()
      nef?.dispose()
      root.removeFromParent()
      if (ctxRef && ctxRef.services.drift === service) delete ctxRef.services.drift
    },
  }
}
