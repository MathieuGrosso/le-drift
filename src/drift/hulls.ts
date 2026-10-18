import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { DECKS, DISTRICTS, NEF_VOID, districtAt } from '../core/layout'
import type { DistrictId, GameContext, Vec3 } from '../core/types'
import { GeoBuilder } from './builder'
import type { Mats } from './materials'
import { NOISE_GLSL } from './materials'
import { PAL } from './palette'

export interface HullDef {
  kind: 'keel' | 'barrel'
  district: DistrictId
  x: number; y: number; z: number
  yaw: number
  w: number; h: number; l: number
  paint: number
  row: number; tier: number
}

export interface Gangway { a: Vec3; b: Vec3; r: number }

// The walkable v1 quarter (aft, principal deck): generated hulls stay clear of it.
const QUARTER = { x0: -48, x1: 52, z0: 42, z1: 84, y0: -1.5, y1: 9.5 }
const ROW = 12
const KEEL_L = [18, 24, 32] as const
const BARREL_L = [10, 14] as const
const HULL_PAINT: Record<DistrictId, readonly number[]> = {
  ecluse: [PAL.laiton, PAL.rouille, PAL.teal],
  nef: [PAL.laiton, PAL.teal],
  marche: [0xd8644e, PAL.laiton, 0xe3b95f],
  serres: [0x8fbf6a, PAL.teal, PAL.laiton],
  machines: [PAL.rouille, 0x8a6e4b],
  ateliers: [0x6e8fb0, PAL.teal, PAL.laiton],
  scellees: [PAL.teal, 0x52576a],
  hauts: [0xcfefe3, PAL.laiton],
  proue: [0xefe3c4, PAL.laiton],
}

const overlaps = (a: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }, x: number, y: number, z: number, hw: number, hh: number, hl: number) =>
  x + hw > a.x0 && x - hw < a.x1 && z + hl > a.z0 && z - hl < a.z1 && y + hh > a.y0 && y - hh < a.y1

// Streets, not a heap: hulls aligned along z in rows, a few size classes, clear tiers per deck.
export function generateHulls(rng: () => number, reserved: Partial<Record<DistrictId, number>> = {}): { hulls: HullDef[]; gangways: Gangway[] } {
  const hulls: HullDef[] = []
  const gangways: Gangway[] = []
  for (const d of DISTRICTS) {
    const want = Math.max(0, d.hulls - (reserved[d.id] ?? 0))
    const high = d.id === 'hauts'
    const rowStep = high ? ROW * 2 : ROW
    const cands: (HullDef & { prio: number })[] = []
    const pairs: [HullDef, HullDef][] = []
    let row = 0
    for (let x = d.x0 + rowStep / 2; x <= d.x1 - rowStep / 2 + 0.01; x += rowStep, row++) {
      d.decks.forEach((deck, tier) => {
        let z = d.z0 + 2 + rng() * 4
        let prev: HullDef | null = null
        while (z < d.z1 - 6) {
          const keel = !high && rng() < 0.6
          const lens = keel ? KEEL_L : BARREL_L
          let l: number = lens[Math.floor(rng() * lens.length)]!
          if (z + l > d.z1 - 2) l = Math.min(l, d.z1 - 2 - z)
          if (l < 9) break
          const w = high ? 5 : keel ? 7 : 6.5
          const h = high ? 5 : keel ? 6 : 6.5
          const y = DECKS[deck].y + h / 2 + 0.6
          const cz = z + l / 2
          const ok = !overlaps(NEF_VOID, x, y, cz, w / 2, h / 2, l / 2)
            && !overlaps(QUARTER, x, y, cz, w / 2, h / 2, l / 2)
            && [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].every(([sx, sz]) => districtAt({ x: x + sx! * w / 2, y, z: cz + sz! * l / 2 }) === d.id)
          const gap = 2.5 + rng() * 2
          if (ok) {
            const cx = (d.x0 + d.x1) / 2
            const czc = (d.z0 + d.z1) / 2
            const centre = Math.hypot((x - cx) / (d.x1 - d.x0), (cz - czc) / (d.z1 - d.z0))
            const def: HullDef = {
              kind: keel ? 'keel' : 'barrel', district: d.id, x, y, z: cz, yaw: (rng() - 0.5) * 0.1, w, h, l,
              paint: HULL_PAINT[d.id][Math.floor(rng() * HULL_PAINT[d.id].length)]!, row, tier,
            }
            const cand = { ...def, prio: rng() * 0.6 + centre * 0.5 + tier * 0.12 }
            cands.push(cand)
            if (prev) pairs.push([prev, cand])
            prev = cand
          } else prev = null
          z += l + gap
        }
      })
    }
    const keep = new Set<HullDef>([...cands].sort((a, b) => a.prio - b.prio).slice(0, want))
    for (const c of cands) if (keep.has(c)) hulls.push(c)
    for (const [a, b] of pairs) {
      if (!keep.has(a) || !keep.has(b)) continue
      gangways.push({ a: { x: a.x, y: a.y + 0.4, z: a.z + a.l / 2 - 1 }, b: { x: b.x, y: b.y + 0.4, z: b.z - b.l / 2 + 1 }, r: 0.85 })
    }
  }
  const filtered = gangways
  const byLevel = new Map<string, HullDef[]>()
  for (const h of hulls) {
    const k = `${h.district}:${h.tier}`
    const list = byLevel.get(k) ?? []
    list.push(h)
    byLevel.set(k, list)
  }
  for (const list of byLevel.values()) {
    for (const h of list) {
      if (rng() > 0.35) continue
      const next = list.find((o) => Math.abs(o.x - (h.x + ROW)) < 0.1 && Math.abs(o.z - h.z) < (o.l + h.l) / 2 - 4)
      if (!next) continue
      const z = (Math.max(h.z - h.l / 2, next.z - next.l / 2) + Math.min(h.z + h.l / 2, next.z + next.l / 2)) / 2
      filtered.push({ a: { x: h.x + h.w / 2 - 0.5, y: h.y + 0.6, z }, b: { x: next.x - next.w / 2 + 0.5, y: next.y + 0.6, z }, r: 0.75 })
    }
  }
  return { hulls, gangways: filtered }
}

function keelGeometry(): THREE.BufferGeometry {
  const b = new GeoBuilder()
  b.jitter = 0
  const cap = new THREE.CapsuleGeometry(0.5, 1, 3, 10)
  cap.rotateX(Math.PI / 2)
  const paint = (p: THREE.Vector3) => {
    if (p.y < -0.2) return new THREE.Color(0.62, 0.55, 0.6)
    if (Math.abs(p.y - 0.12) < 0.05) return new THREE.Color(1.25, 1.15, 0.9)
    if (p.y > 0.3) return new THREE.Color(1.1, 1.06, 1.0)
    return new THREE.Color(1, 1, 1)
  }
  b.add(cap, new THREE.Matrix4(), paint)
  b.box(0, -0.55, 0, 0.06, 0.25, 1.5, new THREE.Color(0.5, 0.45, 0.5))
  b.box(0, 0.58, -0.1, 0.45, 0.28, 0.42, new THREE.Color(1.15, 1.1, 1.0))
  b.box(0, 0.73, -0.1, 0.5, 0.04, 0.47, new THREE.Color(0.7, 0.65, 0.7))
  b.cyl(0.12, 0.85, -0.2, 0.04, 0.35, new THREE.Color(0.55, 0.52, 0.6))
  return b.build()
}

function barrelGeometry(): THREE.BufferGeometry {
  const b = new GeoBuilder()
  b.jitter = 0
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 12, 1, true)
  cyl.rotateX(Math.PI / 2)
  b.add(cyl, new THREE.Matrix4(), (p) => new THREE.Color().setScalar(p.y < -0.25 ? 0.7 : 1))
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, s * 0.65), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.5, 0.35))
    b.add(new THREE.SphereGeometry(1, 12, 4), m, (p) => new THREE.Color().setScalar(p.y < -0.25 ? 0.7 : 1))
  }
  for (const z of [-0.5, 0.05, 0.55]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0, z), new THREE.Quaternion(), new THREE.Vector3(0.505, 0.505, 0.505))
    b.add(new THREE.TorusGeometry(1, 0.035, 3, 12), m, new THREE.Color(1.3, 1.15, 0.85))
  }
  b.box(0, 0.5, 0, 0.3, 0.12, 0.5, new THREE.Color(1.1, 1.05, 1.0))
  return b.build()
}

const CARD_VERT = /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const CARD_FRAG = /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform vec3 uWarm;
uniform vec3 uCoat;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorldPos;
${NOISE_GLSL}
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float lit = step(0.18, fract(vSeed * 7.31));
  vec3 col = uWarm * (0.75 + 0.25 * sin(uTime * 0.7 + vSeed * 40.0)) * mix(0.35, 1.0, lit);
  float sil = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float px = fract(vSeed * (3.7 + fi * 5.1) + uTime * 0.01 * (fi - 0.5)) - 0.5;
    vec2 head = vec2(px * 0.8, -0.05);
    sil = max(sil, 1.0 - smoothstep(0.1, 0.13, length(c - head)));
    sil = max(sil, 1.0 - smoothstep(0.2, 0.24, length((c - head - vec2(0.0, -0.3)) * vec2(1.0, 0.8))));
  }
  col = mix(col, uWarm * 0.25, sil * 0.75 * lit);
  float n = dFbm(c * 6.0 + vSeed * 11.0);
  float coat = smoothstep(0.55, 0.75, r * 0.6 + n * 0.6 + fract(vSeed * 3.3) * 0.25);
  col = mix(col, uCoat, coat);
  col *= uGlow;
  col = mix(col, uWarm * 0.6, smoothstep(0.86, 1.0, r));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const UP = new THREE.Vector3(0, 1, 0)

interface DistrictMeshes { meshes: THREE.Object3D[]; body: RAPIER.RigidBody | null; loaded: boolean; snap: boolean }

export class Hulls {
  readonly defs: HullDef[]
  readonly gangways: Gangway[]
  readonly group = new THREE.Group()
  private readonly cardMat: THREE.ShaderMaterial
  private readonly districts = new Map<DistrictId, DistrictMeshes>()
  private time = 0

  constructor(private readonly ctx: GameContext, mats: Mats, parent: THREE.Object3D, pose: { position: Vec3; heading: number }) {
    const gen = generateHulls(ctx.rng('drift-rues'), { ecluse: 12 })
    this.defs = gen.hulls
    this.gangways = gen.gangways
    this.group.name = 'drift-coques'
    parent.add(this.group)
    const hullMat = mats.cel({ color: 0xffffff, vertexColors: true, caustics: true, rim: 0.9 })
    this.cardMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: 1 },
        uWarm: { value: new THREE.Color(PAL.vitre) },
        uCoat: { value: new THREE.Color(PAL.revetement) },
      },
      vertexShader: CARD_VERT,
      fragmentShader: CARD_FRAG,
    })
    mats.water(this.cardMat)
    const keelGeo = keelGeometry()
    const barrelGeo = barrelGeometry()
    const cardGeo = new THREE.CircleGeometry(0.5, 16)
    const tmpM = new THREE.Matrix4()
    const tmpQ = new THREE.Quaternion()
    const tmpC = new THREE.Color()
    const accent = new THREE.Color()
    for (const d of DISTRICTS) {
      const list = this.defs.filter((h) => h.district === d.id)
      const meshes: THREE.Object3D[] = []
      accent.set(d.accent)
      for (const kind of ['keel', 'barrel'] as const) {
        const ofKind = list.filter((h) => h.kind === kind)
        if (ofKind.length === 0) continue
        const im = new THREE.InstancedMesh(kind === 'keel' ? keelGeo : barrelGeo, hullMat, ofKind.length)
        ofKind.forEach((h, i) => {
          tmpQ.setFromAxisAngle(UP, -h.yaw)
          tmpM.compose(new THREE.Vector3(h.x, h.y, h.z), tmpQ, new THREE.Vector3(h.w, h.h, h.l / 2))
          im.setMatrixAt(i, tmpM)
          im.setColorAt(i, tmpC.set(h.paint).lerp(accent, 0.25).offsetHSL(0, 0, (((i * 37) % 11) / 11 - 0.5) * 0.08))
        })
        im.computeBoundingSphere()
        im.name = `coques-${d.id}-${kind}`
        meshes.push(im)
      }
      const cards: THREE.Matrix4[] = []
      const seeds: number[] = []
      list.forEach((h, hi) => {
        const n = Math.max(2, Math.floor(h.l / 3.2))
        const q = new THREE.Quaternion().setFromAxisAngle(UP, -h.yaw)
        for (const side of [-1, 1]) {
          const faceQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, (side * Math.PI) / 2))
          for (let i = 0; i < n; i++) {
            const zz = (i / (n - 1) - 0.5) * h.l * 0.5
            const yy = h.kind === 'keel' ? h.h * 0.08 : 0
            const local = new THREE.Vector3(side * (h.w / 2 + 0.04), yy, zz).applyQuaternion(q).add(new THREE.Vector3(h.x, h.y, h.z))
            const sc = h.kind === 'keel' ? 0.85 : 0.75
            cards.push(new THREE.Matrix4().compose(local, faceQ, new THREE.Vector3(sc, sc, 1)))
            seeds.push(((hi * 13 + (side > 0 ? 3 : 0)) * 0.61803 + i * 0.001) % 1)
          }
        }
      })
      if (cards.length > 0) {
        const g = cardGeo.clone()
        g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
        const cardIm = new THREE.InstancedMesh(g, this.cardMat, cards.length)
        cards.forEach((m, i) => cardIm.setMatrixAt(i, m))
        cardIm.computeBoundingSphere()
        cardIm.name = `hublots-${d.id}`
        meshes.push(cardIm)
      }
      for (const m of meshes) this.group.add(m)
      this.districts.set(d.id, { meshes, body: null, loaded: true, snap: false })
    }
    this.buildGangways(mats)
    this.buildColliders(pose)
  }

  private buildGangways(mats: Mats): void {
    const tube = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true)
    tube.rotateX(Math.PI / 2)
    const mat = mats.cel({ color: PAL.laiton, side: THREE.DoubleSide, rim: 0.8 })
    const im = new THREE.InstancedMesh(tube, mat, this.gangways.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const lamps: THREE.Vector3[] = []
    this.gangways.forEach((g, i) => {
      a.set(g.a.x, g.a.y, g.a.z)
      b.set(g.b.x, g.b.y, g.b.z)
      const dir = b.clone().sub(a)
      const len = Math.max(0.1, dir.length())
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
      m.compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(g.r, g.r, len))
      im.setMatrixAt(i, m)
      if (i % 2 === 0) lamps.push(a.clone().lerp(b, 0.5).setY(Math.max(a.y, b.y) + g.r + 0.2))
    })
    im.computeBoundingSphere()
    im.name = 'passerelles'
    this.group.add(im)
    const tops = this.domeTops()
    const lm = mats.water(new THREE.MeshBasicMaterial({ color: PAL.lampe }))
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), lm, lamps.length + tops.length)
    lamps.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)))
    tops.forEach((p, i) => bulbs.setMatrixAt(lamps.length + i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(5, 3.5, 5))))
    bulbs.setColorAt(0, new THREE.Color(PAL.lampe))
    for (let i = 0; i < tops.length; i++) bulbs.setColorAt(lamps.length + i, new THREE.Color(PAL.froid))
    bulbs.computeBoundingSphere()
    bulbs.name = 'lanternes'
    this.group.add(bulbs)
  }

  private domeTops(): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    for (const d of DISTRICTS) {
      if (d.id === 'hauts' || d.id === 'machines') continue
      let best: HullDef | null = null
      for (const h of this.defs) if (h.district === d.id && (!best || h.y > best.y)) best = h
      if (best) out.push(new THREE.Vector3(best.x, best.y + best.h / 2 + 0.8, best.z))
    }
    return out
  }

  private buildColliders(pose: { position: Vec3; heading: number }): void {
    const R = this.ctx.physics.rapier
    const q = new THREE.Quaternion().setFromAxisAngle(UP, -pose.heading)
    const g = this.ctx.physics.groups
    const groups = ((g.TERRAIN & 0xffff) << 16) | 0xffff
    for (const [id, dm] of this.districts) {
      const body = this.ctx.physics.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(pose.position.x, pose.position.y, pose.position.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      )
      dm.body = body
      this.defs.forEach((d, i) => {
        if (d.district !== id) return
        const r = Math.min(d.w, d.h) * 0.4
        const hq = new THREE.Quaternion().setFromAxisAngle(UP, -d.yaw)
        const desc = R.ColliderDesc.roundCuboid(Math.max(0.05, d.w / 2 - r), Math.max(0.05, d.h / 2 - r), Math.max(0.05, d.l * 0.45 - r), r)
          .setTranslation(d.x, d.y, d.z)
          .setRotation({ x: hq.x, y: hq.y, z: hq.z, w: hq.w })
          .setCollisionGroups(groups)
        const c = this.ctx.physics.world.createCollider(desc, body)
        this.ctx.physics.tag(c, { kind: 'hull', climbable: true, ownerId: `coque-${id}-${i}` })
      })
    }
  }

  setLoaded(loaded: ReadonlySet<DistrictId>): void {
    for (const [id, dm] of this.districts) {
      const on = loaded.has(id)
      if (on === dm.loaded || !dm.body) continue
      dm.loaded = on
      dm.snap = on
      for (let i = 0; i < dm.body.numColliders(); i++) dm.body.collider(i).setEnabled(on)
    }
  }

  setVisible(visible: ReadonlySet<DistrictId> | null): void {
    for (const [id, dm] of this.districts) {
      const on = visible === null || visible.has(id)
      for (const m of dm.meshes) m.visible = on
    }
  }

  update(dt: number, pose: { position: Vec3; heading: number }, jumped: boolean): void {
    this.time += dt
    this.cardMat.uniforms.uTime!.value = this.time
    const h = this.ctx.state.time.hours
    const night = h >= 19.5 || h < 5.5 ? 1 : h >= 17 ? (h - 17) / 2.5 : h < 7 ? (7 - h) / 1.5 : 0
    this.cardMat.uniforms.uGlow!.value = 0.95 + 0.45 * night
    const q = new THREE.Quaternion().setFromAxisAngle(UP, -pose.heading)
    for (const dm of this.districts.values()) {
      const body = dm.body
      if (!body || !dm.loaded) continue
      if (jumped || dm.snap) {
        dm.snap = false
        body.setTranslation(pose.position, true)
        body.setRotation(q, true)
      } else {
        body.setNextKinematicTranslation(pose.position)
        body.setNextKinematicRotation(q)
      }
    }
  }

  dispose(): void {
    for (const dm of this.districts.values()) {
      if (!dm.body) continue
      try {
        for (let i = 0; i < dm.body.numColliders(); i++) this.ctx.physics.untag(dm.body.collider(i))
        this.ctx.physics.world.removeRigidBody(dm.body)
      } catch {
        /* world may be gone */
      }
    }
    this.group.removeFromParent()
  }
}
