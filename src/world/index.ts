import * as THREE from 'three'
import { BLEU_EDGE, HERO_MAX_Y, VISTA } from '../core/layout'
import type { GameContext, System, Vec3, WorldService } from '../core/types'
import { TerrainStreamer } from './chunks'
import { currentAt } from './current'
import { ARCHES, Landmarks } from './landmarks'
import { makeMaterial } from './surface'
import { heightAt, normalAt, regionAt, VENT } from './terrain'

const STREAM_BUDGET_MS = 5

function isSafe(x: number, z: number): boolean {
  if (Math.abs(x) > BLEU_EDGE - 30 || Math.abs(z) > BLEU_EDGE - 30) return false
  if (Math.hypot(x - VENT.x, z - VENT.z) < 45) return false
  for (const a of ARCHES) if (Math.hypot(x - a.x, z - a.z) < a.radius + a.tube + 4) return false
  return normalAt(x, z, 1.5).y > 0.82
}

export function safeSpawnNear(p: Vec3): Vec3 {
  const cx = Math.max(-(BLEU_EDGE - 30), Math.min(BLEU_EDGE - 30, p.x))
  const cz = Math.max(-(BLEU_EDGE - 30), Math.min(BLEU_EDGE - 30, p.z))
  for (let ring = 0; ring <= 40; ring++) {
    const r = ring * 6
    const n = ring === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 6)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (isSafe(x, z)) return { x, y: Math.min(heightAt(x, z) + 1.2, HERO_MAX_Y - 1), z }
    }
  }
  const v = { x: VISTA.hero.x, z: VISTA.hero.z }
  return { x: v.x, y: heightAt(v.x, v.z) + 1.2, z: v.z }
}

function registerPoses(ctx: GameContext): void {
  const y = (x: number, z: number) => heightAt(x, z)
  ctx.services.debug.registerPose('monde', {
    hour: 10,
    camera: { position: { x: -120, y: 116, z: 980 }, target: { x: 60, y: 10, z: -200 }, fov: 70 },
  })
  ctx.services.debug.registerPose('pilier', {
    hour: 9,
    camera: { position: { x: -150, y: y(-150, 150) + 12, z: 150 }, target: { x: 0, y: 60, z: 0 }, fov: 55 },
  })
  ctx.services.debug.registerPose('seuil', {
    hour: 12,
    camera: { position: { x: 60, y: Math.min(115, y(60, -850) + 12), z: -850 }, target: { x: 120, y: 108, z: -960 }, fov: 55 },
  })
}

export function createWorldSystem(): System {
  let streamer: TerrainStreamer | null = null
  let landmarks: Landmarks | null = null
  let material: THREE.Material | null = null
  let ctxRef: GameContext | null = null
  let offQuality: (() => void) | null = null

  const service: WorldService = {
    heightAt,
    normalAt: (x, z) => normalAt(x, z),
    regionAt,
    currentAt: (p) => currentAt(p, ctxRef?.state.env.current ?? { x: 0, y: 0, z: 0 }),
    isLoaded: (cx, cz) => streamer?.isLoaded(cx, cz) ?? false,
    safeSpawnNear,
  }

  return {
    id: 'world',
    init(ctx) {
      ctxRef = ctx
      ctx.services.world = service
      material = makeMaterial(ctx, { color: 0xffffff, vertexColors: true })
      streamer = new TerrainStreamer(ctx, material)
      landmarks = new Landmarks(ctx)
      ctx.scene.add(streamer.group, landmarks.group)
      offQuality = ctx.quality.onChange(() => streamer?.rebuildForQuality())
      registerPoses(ctx)
    },
    update(_dt, ctx) {
      if (!streamer) return
      streamer.update(ctx.state.hero.position, ctx.state.hero.medium === 'air', STREAM_BUDGET_MS)
      landmarks?.update(ctx.clock.elapsed)
    },
    dispose() {
      offQuality?.()
      streamer?.dispose()
      landmarks?.dispose()
      material?.dispose()
      if (ctxRef?.services.world === service) delete ctxRef.services.world
      streamer = null
      landmarks = null
      ctxRef = null
    },
  }
}

