import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { LANDMARKS } from '../core/layout'
import type { GameContext, Vec3 } from '../core/types'
import { GeoBuilder } from './builder'
import type { Mats } from './materials'
import { NOISE_GLSL } from './materials'
import { PAL } from './palette'

export interface HullDef {
  kind: 'keel' | 'barrel'
  x: number; y: number; z: number
  yaw: number
  w: number; h: number; l: number
  paint: number
}

const CLEAR = { x0: -48, x1: 52, z0: 42, z1: 84 }

export function generateHulls(rng: () => number, count: number): HullDef[] {
  const out: HullDef[] = []
  const hw = LANDMARKS.drift.width / 2
  const hd = LANDMARKS.drift.depth / 2
  const paints = [PAL.rouille, PAL.laiton, PAL.teal]
  let attempts = 0
  while (out.length < count && attempts < 40000) {
    attempts++
    const a = rng() * Math.PI * 2
    const r = Math.pow(rng(), 0.7)
    const x = Math.cos(a) * r * hw
    const z = Math.sin(a) * r * hd
    const centre = 1 - r
    const y = -12 + rng() * 26 + centre * 6
    const keel = rng() < 0.62
    const l = keel ? 14 + rng() * 18 : 10 + rng() * 12
    const w = keel ? 5 + rng() * 4 : 5 + rng() * 3
    const h = keel ? 4.5 + rng() * 3.5 : w * (0.9 + rng() * 0.15)
    const yaw = (rng() - 0.5) * 0.5
    const ex = Math.abs(Math.cos(yaw)) * w / 2 + Math.abs(Math.sin(yaw)) * l / 2
    const ez = Math.abs(Math.sin(yaw)) * w / 2 + Math.abs(Math.cos(yaw)) * l / 2
    if (x + ex > CLEAR.x0 && x - ex < CLEAR.x1 && z + ez > CLEAR.z0 && z - ez < CLEAR.z1) continue
    let ok = true
    for (const o of out) {
      const ox = Math.abs(Math.cos(o.yaw)) * o.w / 2 + Math.abs(Math.sin(o.yaw)) * o.l / 2
      const oz = Math.abs(Math.sin(o.yaw)) * o.w / 2 + Math.abs(Math.cos(o.yaw)) * o.l / 2
      if (Math.abs(o.x - x) < ox + ex + 1.2 && Math.abs(o.z - z) < oz + ez + 1.2 && Math.abs(o.y - y) < (o.h + h) / 2 + 1.5) {
        ok = false
        break
      }
    }
    if (!ok) continue
    out.push({ kind: keel ? 'keel' : 'barrel', x, y, z, yaw, w, h, l, paint: paints[Math.floor(rng() * paints.length)]! })
  }
  return out
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

export class Hulls {
  readonly defs: HullDef[]
  private readonly cardMat: THREE.ShaderMaterial
  private body: RAPIER.RigidBody | null = null
  readonly group = new THREE.Group()
  private time = 0
  private readonly lod: { mesh: THREE.InstancedMesh; prefix: number[] }[] = []
  private readonly cardPrefix: number[] = []
  private shown = -1

  constructor(private readonly ctx: GameContext, mats: Mats, parent: THREE.Object3D, pose: { position: Vec3; heading: number }) {
    this.defs = generateHulls(ctx.rng('drift-coques'), LANDMARKS.drift.hulls - LANDMARKS.drift.walkableHulls)
      .sort((a, b) => Math.hypot(a.x, a.z - 62) - Math.hypot(b.x, b.z - 62))
    this.group.name = 'drift-coques'
    parent.add(this.group)
    const hullMat = mats.cel({ color: 0xffffff, vertexColors: true, caustics: true })
    const tmpM = new THREE.Matrix4()
    const tmpQ = new THREE.Quaternion()
    const tmpC = new THREE.Color()
    for (const kind of ['keel', 'barrel'] as const) {
      const list = this.defs.filter((d) => d.kind === kind)
      const im = new THREE.InstancedMesh(kind === 'keel' ? keelGeometry() : barrelGeometry(), hullMat, list.length)
      list.forEach((d, i) => {
        tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -d.yaw)
        tmpM.compose(new THREE.Vector3(d.x, d.y, d.z), tmpQ, new THREE.Vector3(d.w, d.h, d.l / 2))
        im.setMatrixAt(i, tmpM)
        im.setColorAt(i, tmpC.set(d.paint).offsetHSL(0, 0, (((i * 37) % 11) / 11 - 0.5) * 0.1))
      })
      im.computeBoundingSphere()
      this.group.add(im)
      let running = 0
      this.lod.push({ mesh: im, prefix: this.defs.map((d) => (running += d.kind === kind ? 1 : 0)) })
    }

    const cards: THREE.Matrix4[] = []
    const seeds: number[] = []
    this.defs.forEach((d, hi) => {
      this.cardPrefix.push(cards.length)
      const n = Math.max(2, Math.floor(d.l / 4))
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -d.yaw)
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const zz = (i / (n - 1) - 0.5) * d.l * 0.42
          const yy = d.kind === 'keel' ? d.h * 0.08 : 0
          const halfW = d.w / 2
          const local = new THREE.Vector3(side * (halfW + 0.04), yy, zz).applyQuaternion(q).add(new THREE.Vector3(d.x, d.y, d.z))
          const faceQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2))
          const s = d.kind === 'keel' ? 0.85 : 0.75
          cards.push(new THREE.Matrix4().compose(local, faceQ, new THREE.Vector3(s, s, 1)))
          seeds.push(((hi * 13 + i * 7 + (side > 0 ? 3 : 0)) * 0.61803) % 1)
        }
      }
    })
    const cardGeo = new THREE.CircleGeometry(0.5, 16)
    cardGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
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
    const cardIm = new THREE.InstancedMesh(cardGeo, this.cardMat, cards.length)
    cards.forEach((m, i) => cardIm.setMatrixAt(i, m))
    cardIm.computeBoundingSphere()
    this.group.add(cardIm)
    this.cardPrefix.push(cards.length)
    this.lod.push({ mesh: cardIm, prefix: this.defs.map((_, k) => this.cardPrefix[k + 1]!) })

    this.buildRopes(mats)
    this.buildColliders(pose)
  }

  private buildRopes(mats: Mats): void {
    const pts: number[] = []
    const lanterns: THREE.Vector3[] = []
    const used = new Set<string>()
    this.defs.forEach((a, i) => {
      let best = -1
      let bestD = 30
      this.defs.forEach((b, j) => {
        if (i === j || used.has(`${Math.min(i, j)}:${Math.max(i, j)}`)) return
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
        if (d < bestD) {
          bestD = d
          best = j
        }
      })
      if (best < 0) return
      used.add(`${Math.min(i, best)}:${Math.max(i, best)}`)
      const b = this.defs[best]!
      const p0 = new THREE.Vector3(a.x, a.y + a.h * 0.42, a.z)
      const p1 = new THREE.Vector3(b.x, b.y + b.h * 0.42, b.z)
      const dir = p1.clone().sub(p0)
      const len = dir.length()
      p0.addScaledVector(dir, (a.w * 0.4) / len)
      p1.addScaledVector(dir, -(b.w * 0.4) / len)
      const segs = 8
      let prev = p0.clone()
      for (let s = 1; s <= segs; s++) {
        const t = s / segs
        const p = p0.clone().lerp(p1, t)
        p.y -= Math.sin(t * Math.PI) * len * 0.08
        pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z)
        prev = p
      }
      if (i % 2 === 0) {
        const mid = p0.clone().lerp(p1, 0.5)
        mid.y -= len * 0.08 + 0.3
        lanterns.push(mid)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const lineMat = mats.water(new THREE.LineBasicMaterial({ color: PAL.boisOmbre }))
    this.group.add(new THREE.LineSegments(g, lineMat))
    const lm = mats.water(new THREE.MeshBasicMaterial({ color: PAL.lampe }))
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), lm, lanterns.length)
    lanterns.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)))
    im.computeBoundingSphere()
    this.group.add(im)
  }

  private buildColliders(pose: { position: Vec3; heading: number }): void {
    const R = this.ctx.physics.rapier
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    this.body = this.ctx.physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pose.position.x, pose.position.y, pose.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    )
    const g = this.ctx.physics.groups
    const groups = ((g.TERRAIN & 0xffff) << 16) | 0xffff
    this.defs.forEach((d, i) => {
      const r = Math.min(d.w, d.h) * 0.4
      const hq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -d.yaw)
      const desc = R.ColliderDesc.roundCuboid(Math.max(0.05, d.w / 2 - r), Math.max(0.05, d.h / 2 - r), Math.max(0.05, d.l * 0.45 - r), r)
        .setTranslation(d.x, d.y, d.z)
        .setRotation({ x: hq.x, y: hq.y, z: hq.z, w: hq.w })
        .setCollisionGroups(groups)
      const c = this.ctx.physics.world.createCollider(desc, this.body!)
      this.ctx.physics.tag(c, { kind: 'hull', climbable: true, ownerId: `coque-${i}` })
    })
  }

  update(dt: number, pose: { position: Vec3; heading: number }, jumped: boolean, indoor: boolean): void {
    this.time += dt
    const level = this.ctx.quality.level
    const want = !indoor || level === 'high' ? this.defs.length : Math.min(this.defs.length, level === 'medium' ? 200 : 90)
    if (want !== this.shown) {
      this.shown = want
      for (const l of this.lod) l.mesh.count = want > 0 ? l.prefix[want - 1]! : 0
    }
    this.cardMat.uniforms.uTime!.value = this.time
    const h = this.ctx.state.time.hours
    const night = h >= 19.5 || h < 5.5 ? 1 : h >= 17 ? (h - 17) / 2.5 : h < 7 ? (7 - h) / 1.5 : 0
    this.cardMat.uniforms.uGlow!.value = 0.85 + 0.45 * night
    if (!this.body) return
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pose.heading)
    if (jumped) {
      this.body.setTranslation(pose.position, true)
      this.body.setRotation(q, true)
    } else {
      this.body.setNextKinematicTranslation(pose.position)
      this.body.setNextKinematicRotation(q)
    }
  }

  nearestHull(local: Vec3): HullDef | null {
    let best: HullDef | null = null
    let bd = Infinity
    for (const d of this.defs) {
      const dd = (d.x - local.x) ** 2 + (d.y - local.y) ** 2 + (d.z - local.z) ** 2
      if (dd < bd) {
        bd = dd
        best = d
      }
    }
    return best
  }

  dispose(): void {
    if (this.body) {
      try {
        for (let i = 0; i < this.body.numColliders(); i++) this.ctx.physics.untag(this.body.collider(i))
        this.ctx.physics.world.removeRigidBody(this.body)
      } catch {
        /* world may be gone */
      }
    }
    this.group.removeFromParent()
  }
}
