import * as THREE from 'three'
import type { DebugPose, GameContext, LockId, System, Vec3, WorldService } from '../core/types'
import { TerrainStreamer } from './chunks'
import { currentAt } from './current'
import { RouteDebris } from './debris'
import { FarKelp } from './kelpfar'
import { Landmarks } from './landmarks'
import { SeaVolume } from './seavolume'
import { driftShadeShader, updateDriftShade } from './shade'
import { clampSwimLocal, SortieSpace, SWIM_LIMITS, type SortieRing, type SwimLimits } from './sortie'
import { makeMaterial } from './surface'
import { heightAt, normalAt, regionAt, TRENCH } from './terrain'
import { Wake } from './wake'
import { Wrecks } from './wrecks'

export type { SortieRing, SwimLimits } from './sortie'

export interface WorldSortieService extends WorldService {
  sortieBounds(lockId: LockId): { ringsLocal: Vec3[]; ringIds: string[]; tetherMax: number }
  nearestRing(local: Vec3, maxDist: number): SortieRing | null
  swimLimits(): SwimLimits
  clampSwimLocal(local: Vec3, out?: Vec3): Vec3
  seaVisible(): boolean
  ringAnchors(): { kind: 'ring'; id: string; at: Vec3 }[]
}

const STREAM_BUDGET_MS = 4

type GlassAware = { glassPortalsVisible?: () => number }
type FactoryRegistry = { registerFactory?: (name: string, f: (ctx: GameContext) => DebugPose) => void }
type AnchorSink = { setAnchors?: (source: string, anchors: { kind: 'ring'; id: string; at: Vec3 }[] | null) => void }

function seaVisible(ctx: GameContext): boolean {
  if (ctx.state.mode === 'sortie') return true
  const drift = ctx.services.drift as (GameContext['services']['drift'] & GlassAware) | undefined
  if (drift?.glassPortalsVisible) return drift.glassPortalsVisible() > 0
  return true
}

function registerPoses(ctx: GameContext): void {
  ctx.services.debug.registerPose('monde', {
    hour: 10,
    camera: { position: { x: -120, y: 116, z: 980 }, target: { x: 60, y: 10, z: -200 }, fov: 70 },
  })
  const reg = ctx.services.debug as FactoryRegistry
  const local = (c: GameContext, eye: Vec3, at: Vec3, hour: number, fov = 55) => {
    const drift = c.services.drift
    if (!drift) return { hour, camera: { position: eye, target: at, fov } }
    return { hour, place: 'sortie', camera: { position: drift.toWorld(eye), target: drift.toWorld(at), fov } }
  }
  reg.registerFactory?.('sous-la-quille', (c) => local(c, { x: 30, y: -30, z: 60 }, { x: -10, y: TRENCH.floorY - 58, z: -40 }, 10, 62))
  reg.registerFactory?.('laminaires-lointaines', (c) => local(c, { x: -150, y: 4, z: 20 }, { x: -420, y: -12, z: 60 }, 9.5, 55))
  reg.registerFactory?.('anneaux', (c) => local(c, { x: 26, y: 7, z: 100 }, { x: 6, y: 3, z: 78 }, 7.5, 55))
  reg.registerFactory?.('sillage', (c) => local(c, { x: 14, y: -6, z: 128 }, { x: 0, y: -16, z: 84 }, 8, 60))
  reg.registerFactory?.('nuit-bio', (c) => ({ ...local(c, { x: 20, y: -30, z: 40 }, { x: -30, y: TRENCH.floorY - 55, z: -60 }, 22.5, 62), hour: 22.5 }))
  ctx.services.debug.registerPose('epaves', {
    hour: 11,
    place: 'sortie',
    camera: { position: { x: 436, y: 4, z: -296 }, target: { x: 405, y: -20, z: -323 }, fov: 60 },
  })
}

export function createWorldSystem(): System {
  let streamer: TerrainStreamer | null = null
  let landmarks: Landmarks | null = null
  let kelp: FarKelp | null = null
  let debris: RouteDebris | null = null
  let sortie: SortieSpace | null = null
  let wake: Wake | null = null
  let wrecks: Wrecks | null = null
  let sea: SeaVolume | null = null
  let anchorsSent = -1
  let material: THREE.Material | null = null
  let ctxRef: GameContext | null = null
  const backdrop = new THREE.Group()
  backdrop.name = 'world-backdrop'
  const offs: (() => void)[] = []

  const service: WorldSortieService = {
    heightAt,
    normalAt: (x, z) => normalAt(x, z),
    regionAt,
    currentAt: (p) => currentAt(p, ctxRef?.state.env.current ?? { x: 0, y: 0, z: 0 }, ctxRef?.state.drift.position ?? null),
    isLoaded: (cx, cz) => streamer?.isLoaded(cx, cz) ?? false,
    sortieBounds: (lockId) => sortie?.bounds(lockId) ?? { ringsLocal: [], ringIds: [], tetherMax: 35 },
    nearestRing: (l, r) => sortie?.nearest(l, r) ?? null,
    swimLimits: () => SWIM_LIMITS,
    clampSwimLocal: (l, out) => clampSwimLocal(l, out),
    seaVisible: () => (ctxRef ? seaVisible(ctxRef) : true),
    ringAnchors: () => sortie?.ringAnchors() ?? [],
  }

  return {
    id: 'world',
    init(ctx) {
      ctxRef = ctx
      ctx.services.world = service
      material = makeMaterial(ctx, { color: 0xffffff, vertexColors: true, onShader: driftShadeShader })
      streamer = new TerrainStreamer(ctx, material)
      landmarks = new Landmarks(ctx)
      debris = new RouteDebris(ctx)
      wrecks = new Wrecks(ctx)
      wake = new Wake(ctx)
      backdrop.add(streamer.group, landmarks.group, debris.group, wrecks.group, wake.mesh)
      if (ctx.services.render) {
        kelp = new FarKelp(ctx)
        backdrop.add(kelp.mesh)
      }
      sortie = new SortieSpace(ctx)
      sea = new SeaVolume(ctx)
      ctx.scene.add(backdrop, sortie.group, sea.dome)
      sortie.lockRing('sas')
      offs.push(ctx.quality.onChange((q) => {
        streamer?.rebuildForQuality()
        kelp?.setQuality(q.level)
        wake?.setQuality(q.level)
      }))
      offs.push(ctx.bus.on('district:streamed', () => sortie?.invalidate()))
      offs.push(ctx.bus.on('sortie:start', ({ lockId }) => {
        sortie?.lockRing(lockId)
        sortie?.invalidate()
      }))
      registerPoses(ctx)
    },
    update(dt, ctx) {
      if (!streamer) return
      updateDriftShade(ctx.state)
      sea?.update(dt)
      const visible = seaVisible(ctx)
      backdrop.visible = visible
      const outside = ctx.state.mode === 'sortie'
      if (visible) streamer.update(ctx.state.hero.position, !outside, STREAM_BUDGET_MS)
      landmarks?.update(ctx.clock.elapsed)
      sortie?.update(dt, outside)
      if (sortie) sortie.group.visible = visible
      wake?.update(ctx.state)
      const sink = ctx.services.hero as unknown as AnchorSink | undefined
      if (sortie && sink?.setAnchors && anchorsSent !== sortie.version) {
        anchorsSent = sortie.version
        sink.setAnchors('world-anneaux', sortie.ringAnchors())
      }
    },
    dispose() {
      for (const o of offs.splice(0)) o()
      streamer?.dispose()
      landmarks?.dispose()
      kelp?.dispose()
      debris?.dispose()
      sortie?.dispose()
      wake?.dispose()
      wrecks?.dispose()
      sea?.dispose()
      material?.dispose()
      backdrop.removeFromParent()
      if (ctxRef?.services.world === service) delete ctxRef.services.world
      streamer = null
      landmarks = null
      kelp = null
      debris = null
      sortie = null
      wake = null
      wrecks = null
      sea = null
      ctxRef = null
    },
  }
}
