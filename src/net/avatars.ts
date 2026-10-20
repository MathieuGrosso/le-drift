import * as THREE from 'three'
import { INDOOR, MOVE, NET, PHYSICS } from '../core/tuning'
import type { GameContext, Vec3 } from '../core/types'
import type { AnimParams, ClipId } from '../hero/anim'
import { Animator } from '../hero/anim'
import { buildHero, PALETTE, type HeroModel } from '../hero/model'
import { Scarf } from '../hero/scarf'
import { createHeroMaterials, type HeroMaterials } from '../hero/shading'
import type { AvatarView, EmoteId, PlayerId } from '../shared/protocol'

interface Sample { t: number; x: number; y: number; z: number; yaw: number }

const MODE_CLIP: Record<string, ClipId> = {
  idle: 'idle-dry', walk: 'walk-dry', swim: 'swim', climb: 'climb', scrub: 'scrub', ladder: 'ladder',
  sit: 'sit', lean: 'lean', sleep: 'sleep', fall: 'fall', cutscene: 'idle-dry', airlock: 'idle-dry',
}
const EMOTE_CLIP: Record<EmoteId, ClipId> = {
  salut: 'talk', oui: 'talk', non: 'shake-off', rire: 'talk', applaudir: 'pump', montrer: 'hand-on-glass',
  assis: 'sit', dort: 'sleep', pluie: 'hand-on-ceiling',
}
const EMOTE_SECONDS = 3
const STRIDE_METRES = 0.9
const RUN_THRESHOLD = (MOVE.walk + MOVE.run) / 2
const MAX_SAMPLES = 24
const STILL_SPEED = 0.2
const SPEED_SMOOTHING = 8
// Cloth vertices are recognised by hue ratio, since paint() bakes a per-vertex shade into the colour.
const TINTED = [PALETTE.tunique, PALETTE.tuniqueOmbre, PALETTE.doublure] as const
const RATIO_TOLERANCE = 0.03

const UP = new THREE.Vector3(0, 1, 0)
const GRAVITY = new THREE.Vector3(0, PHYSICS.indoorGravity, 0)
const NO_GRAVITY = new THREE.Vector3()
const NO_FLOW = new THREE.Vector3()

function ratios(c: THREE.Color): [number, number, number] {
  const m = Math.max(c.r, c.g, c.b, 1e-6)
  return [c.r / m, c.g / m, c.b / m]
}

function tintCloth(geo: THREE.BufferGeometry, color: number): void {
  const attr = geo.getAttribute('color')
  if (!attr) return
  const base = new THREE.Color(PALETTE.tunique)
  const targets = TINTED.map((hex) => {
    const c = new THREE.Color(hex)
    return { ratio: ratios(c), max: Math.max(c.r, c.g, c.b), scale: Math.max(c.r, c.g, c.b) / Math.max(base.r, base.g, base.b) }
  })
  const player = new THREE.Color(color)
  const playerMax = Math.max(player.r, player.g, player.b, 1e-6)
  const v = new THREE.Color()
  for (let i = 0; i < attr.count; i++) {
    v.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i))
    const r = ratios(v)
    const hit = targets.find((t) => t.ratio.every((x, k) => Math.abs(x - r[k]!) < RATIO_TOLERANCE))
    if (!hit) continue
    const shade = Math.max(v.r, v.g, v.b) / hit.max
    const k = (shade * hit.scale * Math.max(base.r, base.g, base.b)) / playerMax
    attr.setXYZ(i, player.r * k, player.g * k, player.b * k)
  }
  attr.needsUpdate = true
}

class RemoteAvatar {
  readonly model: HeroModel
  private readonly mats: HeroMaterials
  private readonly anim: Animator
  private readonly scarf: Scarf
  private readonly samples: Sample[] = []
  private readonly params: AnimParams = {
    t: 0, phase: 0, clipTime: 0, speed: 0, bank: 0, pitch: 0, climbX: 0, climbY: 0, wet: 0, exhausted: false, inWater: false, swing: 0,
  }
  private readonly local = { x: 0, y: 0, z: 0, yaw: 0 }
  private readonly prevLocal = new THREE.Vector3()
  private readonly cur = new THREE.Vector3()
  private readonly q = new THREE.Quaternion()
  private readonly anchor = new THREE.Vector3()
  private readonly right = new THREE.Vector3()
  private readonly colliders = [{ c: new THREE.Vector3(), r: 0.17 }, { c: new THREE.Vector3(), r: 0.215 }, { c: new THREE.Vector3(), r: 0.17 }]
  private gesture: { clip: ClipId; until: number } | null = null
  private placed = false
  color: number

  constructor(ctx: GameContext, color: number) {
    this.color = color
    this.mats = createHeroMaterials(ctx)
    this.model = buildHero(this.mats)
    tintCloth(this.model.mesh.geometry, color)
    this.model.bones.chest.add(this.model.scrubber)
    this.model.scrubber.position.set(-0.01, -0.1, 0.2)
    this.model.scrubber.rotation.set(-0.2, 0, Math.PI - 0.62)
    this.model.voile.visible = false
    this.anim = new Animator(this.model)
    this.scarf = new Scarf(this.mats.cloth)
    ctx.scene.add(this.model.root, this.scarf.mesh)
  }

  push(a: AvatarView, now: number): void {
    const last = this.samples[this.samples.length - 1]
    if (last && last.x === a.x && last.y === a.y && last.z === a.z && last.yaw === a.yaw) return
    this.samples.push({ t: now, x: a.x, y: a.y, z: a.z, yaw: a.yaw })
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()
  }

  play(emote: EmoteId, at: number): void {
    this.gesture = { clip: EMOTE_CLIP[emote], until: at + EMOTE_SECONDS }
  }

  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.model.bones.head.getWorldPosition(out)
  }

  update(dt: number, ctx: GameContext, view: AvatarView, now: number, toWorld: (p: Vec3) => Vec3, heading: number): void {
    this.sample(now - NET.interpDelayMs)
    const w = toWorld(this.local)
    const root = this.model.root
    this.cur.set(this.local.x, this.local.y, this.local.z)
    const speed = this.placed && dt > 0 ? this.cur.distanceTo(this.prevLocal) / dt : 0
    this.prevLocal.copy(this.cur)
    this.placed = true
    root.position.set(w.x, w.y, w.z)
    root.quaternion.copy(this.q.setFromAxisAngle(UP, -(this.local.yaw + heading)))

    const t = ctx.clock.elapsed
    if (this.gesture && this.gesture.until < t) this.gesture = null
    let clip = this.gesture?.clip ?? MODE_CLIP[view.mode] ?? 'idle-dry'
    if (clip === 'walk-dry' && speed > RUN_THRESHOLD) clip = 'run-dry'
    if (clip === 'walk-dry' && speed < STILL_SPEED) clip = 'idle-dry'
    const p = this.params
    p.t = t
    p.speed = THREE.MathUtils.lerp(p.speed, speed, Math.min(1, dt * SPEED_SMOOTHING))
    p.phase += (p.speed * dt) / STRIDE_METRES
    p.inWater = view.mode === 'swim'
    p.wet = view.outside ? 1 : Math.max(0, p.wet - dt / INDOOR.wetnessDrySeconds)
    this.anim.play(clip, t)
    this.anim.update(dt, p)
    root.updateMatrixWorld(true)

    const b = this.model.bones
    b.chest.getWorldPosition(this.colliders[0]!.c)
    b.hips.getWorldPosition(this.colliders[1]!.c)
    b.head.getWorldPosition(this.colliders[2]!.c)
    this.right.set(1, 0, 0).applyQuaternion(root.quaternion)
    this.scarf.update(dt, {
      anchor: this.model.scarfAnchor.getWorldPosition(this.anchor),
      right: this.right, flow: NO_FLOW, inWater: p.inWater, wetness: p.wet, t, colliders: this.colliders,
      floorY: p.inWater ? -1e4 : w.y, gravity: p.inWater ? NO_GRAVITY : GRAVITY,
    })
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.model.root, this.scarf.mesh)
    this.model.rig.dispose()
    this.model.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    this.scarf.mesh.geometry.dispose()
    this.mats.body.dispose()
    this.mats.cloth.dispose()
  }

  private sample(at: number): void {
    const s = this.samples
    if (s.length === 0) return
    let i = s.length - 1
    while (i > 0 && s[i - 1]!.t > at) i--
    const b = s[i]!
    const a = s[i - 1]
    if (!a || at >= b.t) {
      Object.assign(this.local, { x: b.x, y: b.y, z: b.z, yaw: b.yaw })
      return
    }
    const k = THREE.MathUtils.clamp((at - a.t) / Math.max(1, b.t - a.t), 0, 1)
    const dyaw = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))
    this.local.x = a.x + (b.x - a.x) * k
    this.local.y = a.y + (b.y - a.y) * k
    this.local.z = a.z + (b.z - a.z) * k
    this.local.yaw = a.yaw + dyaw * k
  }
}

/** Every other player of the district, drawn as Ilo in their colour, 150 ms behind the server. */
export class RemoteAvatars {
  private readonly avatars = new Map<PlayerId, RemoteAvatar>()

  constructor(private readonly ctx: GameContext) {}

  update(dt: number, views: ReadonlyMap<PlayerId, AvatarView> | null, me: PlayerId | null): void {
    const drift = this.ctx.services.drift
    const now = performance.now()
    for (const [id, a] of this.avatars) {
      if (!views?.has(id) || id === me) this.remove(id, a)
    }
    if (!views || !drift) return
    const heading = drift.pose().heading
    const toWorld = (p: Vec3) => drift.toWorld(p)
    views.forEach((view, id) => {
      if (id === me) return
      let a = this.avatars.get(id)
      if (a && a.color !== view.color) {
        this.remove(id, a)
        a = undefined
      }
      if (!a) {
        a = new RemoteAvatar(this.ctx, view.color)
        this.avatars.set(id, a)
      }
      a.push(view, now)
      a.update(dt, this.ctx, view, now, toWorld, heading)
    })
  }

  emote(id: PlayerId, emote: EmoteId): void {
    this.avatars.get(id)?.play(emote, this.ctx.clock.elapsed)
  }

  head(id: PlayerId, out: THREE.Vector3): THREE.Vector3 | null {
    return this.avatars.get(id)?.headWorld(out) ?? null
  }

  ids(): IterableIterator<PlayerId> {
    return this.avatars.keys()
  }

  clear(): void {
    for (const [id, a] of this.avatars) this.remove(id, a)
  }

  private remove(id: PlayerId, a: RemoteAvatar): void {
    a.dispose(this.ctx.scene)
    this.avatars.delete(id)
  }
}
