import * as THREE from 'three'
import type { GameContext, Vec3 } from '../core/types'
import type { DriftPose } from './frame'
import { dirToWorld, toLocal, toWorld } from './frame'
import type { Quarter } from './interiors/quarter'
import type { PaneDef } from './interiors/types'
import type { Mats } from './materials'
import { NOISE_GLSL } from './materials'

const PANE_VERT = /* glsl */ `
attribute float aCoat;
attribute float aSeed;
attribute vec2 aSize;
varying vec2 vUv;
varying vec2 vMeters;
varying float vCoat;
varying float vSeed;
varying vec3 vWorldPos;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vMeters = (uv - 0.5) * aSize;
  vCoat = aCoat;
  vSeed = aSeed;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const PANE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uRound;
uniform vec3 uCoatColor;
uniform vec3 uSky;
varying vec2 vUv;
varying vec2 vMeters;
varying float vCoat;
varying float vSeed;
varying vec3 vWorldPos;
varying vec3 vNormalW;
${NOISE_GLSL}
void main() {
  vec2 c = vUv - 0.5;
  float edgeDist = uRound > 0.5 ? length(c) * 2.0 : max(abs(c.x), abs(c.y)) * 2.0;
  if (uRound > 0.5 && edgeDist > 1.0) discard;
  float n = dFbm(vMeters * 5.0 + vSeed * 17.0);
  float fine = dNoise(vMeters * 38.0 + vSeed * 3.0);
  float mask = edgeDist * 0.55 + n * 0.55 + fine * 0.12;
  float threshold = 1.15 - vCoat * 1.3;
  float cover = smoothstep(threshold - 0.05, threshold + 0.08, mask) * step(0.02, vCoat);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  bool outside = dot(viewDir, vNormalW) > 0.0;
  vec3 fur = mix(uCoatColor * 0.62, uCoatColor * 1.18, n) * (0.85 + fine * 0.3);
  vec3 glass = mix(uSky, vec3(1.0), 0.25);
  float streak = smoothstep(0.92, 1.0, sin((vUv.x + vUv.y) * 9.0 + vSeed * 6.0)) * 0.25 * (1.0 - vCoat);
  vec3 col;
  float alpha;
  if (outside) {
    col = mix(glass, fur, cover);
    alpha = mix(0.1 + streak, 0.95, cover);
    col += streak;
  } else {
    vec3 sil = mix(uCoatColor * 0.25, uCoatColor * 0.7, (1.0 - fine) * 0.5);
    col = mix(glass * 0.9, sil, cover);
    alpha = mix(0.06 + streak * 0.5, 0.88, cover);
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const CONE_VERT = /* glsl */ `
attribute float aCoat;
varying float vLen;
varying float vCoat;
varying vec3 vN;
varying vec3 vV;
void main() {
  vLen = position.z;
  vCoat = aCoat;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const CONE_FRAG = /* glsl */ `
uniform float uStrength;
uniform vec3 uColor;
varying float vLen;
varying float vCoat;
varying vec3 vN;
varying vec3 vV;
void main() {
  float soft = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float a = pow(1.0 - clamp(vLen, 0.0, 1.0), 1.4) * soft * uStrength * (1.0 - vCoat * 0.85);
  gl_FragColor = vec4(uColor * a, a);
}`

export interface WindowInfo { id: string; coat: number; position: Vec3; normal: Vec3 }

const INITIAL_COAT = 0.9
const _m = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _l: Vec3 = { x: 0, y: 0, z: 0 }

export class Windows {
  readonly panes: PaneDef[]
  private readonly round: THREE.InstancedMesh
  private readonly rect: THREE.InstancedMesh
  private readonly cones: THREE.InstancedMesh
  private readonly coatAttrs: THREE.InstancedBufferAttribute[] = []
  private readonly slot = new Map<string, { mesh: THREE.InstancedMesh; index: number; attr: THREE.InstancedBufferAttribute }>()
  private readonly coneMat: THREE.ShaderMaterial
  private readonly paneMats: THREE.ShaderMaterial[] = []
  private readonly base: THREE.Matrix4[] = []
  private readonly coneBase: THREE.Matrix4[] = []
  private refresh = 0
  private readonly doneSent = new Set<string>()

  constructor(private readonly ctx: GameContext, mats: Mats, private readonly quarter: Quarter, parent: THREE.Object3D) {
    this.panes = quarter.panes
    const roundPanes = this.panes.filter((p) => p.shape === 'round')
    const rectPanes = this.panes.filter((p) => p.shape === 'rect')
    const mk = (geo: THREE.BufferGeometry, list: PaneDef[], round: boolean) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRound: { value: round ? 1 : 0 },
          uCoatColor: { value: new THREE.Color(0x6f8f4e) },
          uSky: { value: new THREE.Color(0x7cc6bf) },
        },
        vertexShader: PANE_VERT,
        fragmentShader: PANE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      mats.water(mat)
      this.paneMats.push(mat)
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length))
      im.count = list.length
      im.frustumCulled = false
      im.renderOrder = 3
      const coat = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length)), 1)
      const seed = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length)), 1)
      const size = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 2), 2)
      coat.setUsage(THREE.DynamicDrawUsage)
      list.forEach((p, i) => {
        seed.setX(i, (i * 0.618) % 1)
        size.setXY(i, p.w, p.h)
        this.slot.set(p.id, { mesh: im, index: i, attr: coat })
      })
      geo.setAttribute('aCoat', coat)
      geo.setAttribute('aSeed', seed)
      geo.setAttribute('aSize', size)
      this.coatAttrs.push(coat)
      parent.add(im)
      return im
    }
    this.round = mk(new THREE.CircleGeometry(0.5, 28), roundPanes, true)
    this.rect = mk(new THREE.PlaneGeometry(1, 1), rectPanes, false)

    const coneGeo = new THREE.CylinderGeometry(0.5, 0.95, 1, 18, 1, true)
    coneGeo.rotateX(Math.PI / 2)
    coneGeo.translate(0, 0, 0.5)
    const coneCoat = new THREE.InstancedBufferAttribute(new Float32Array(this.panes.length), 1)
    coneCoat.setUsage(THREE.DynamicDrawUsage)
    coneGeo.setAttribute('aCoat', coneCoat)
    this.coneMat = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 0.2 }, uColor: { value: new THREE.Color(0xa6e6d6) } },
      vertexShader: CONE_VERT,
      fragmentShader: CONE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.cones = new THREE.InstancedMesh(coneGeo, this.coneMat, this.panes.length)
    this.cones.frustumCulled = false
    this.cones.renderOrder = 4
    parent.add(this.cones)

    for (const p of this.panes) {
      const n = new THREE.Vector3(p.nx, 0, p.nz)
      const up = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(up, n)
      _q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n))
      this.base.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), _q.clone(), new THREE.Vector3(p.w, p.h, 1)))
      const inward = n.clone().negate().add(new THREE.Vector3(0, -0.45, 0)).normalize()
      const r2 = new THREE.Vector3().crossVectors(up, inward).normalize()
      const u2 = new THREE.Vector3().crossVectors(inward, r2)
      const qc = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r2, u2, inward))
      const len = p.shape === 'rect' ? 6 : 3.2
      this.coneBase.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z).addScaledVector(n, -0.12), qc, new THREE.Vector3(p.w, p.h, len)))
    }
    this.coneCoat = coneCoat
    this.update(0, true)
  }
  private readonly coneCoat: THREE.InstancedBufferAttribute

  private now(): number {
    const t = this.ctx.state.time
    return (t.day - 1) * 24 + t.hours
  }

  private regrowHours(): number {
    const s = this.ctx.state
    let h = s.act >= 2 ? 12 : 20
    if (s.drift.position.z < -600) h *= 0.5
    return h
  }

  coat(id: string): number {
    const t = this.ctx.state.windows[id]
    if (t === undefined) return INITIAL_COAT
    return THREE.MathUtils.clamp((this.now() - t) / this.regrowHours(), 0, 1)
  }

  scrub(id: string, amount: number): number {
    if (!this.slot.has(id)) return 0
    const remaining = Math.max(0, this.coat(id) - Math.max(0, amount))
    this.ctx.state.windows[id] = this.now() - remaining * this.regrowHours()
    this.ctx.bus.emit('scrub:progress', { windowId: id, coat: remaining })
    if (remaining <= 0.02) {
      if (!this.doneSent.has(id)) {
        this.doneSent.add(id)
        this.ctx.bus.emit('scrub:done', { windowId: id })
      }
    } else {
      this.doneSent.delete(id)
    }
    this.writeCoat(id)
    return remaining
  }

  private writeCoat(id: string): void {
    const s = this.slot.get(id)
    if (!s) return
    s.attr.setX(s.index, this.coat(id))
    s.attr.needsUpdate = true
  }

  nearest(pose: DriftPose, p: Vec3, maxDist: number): WindowInfo | null {
    toLocal(pose, p, _l)
    let best: PaneDef | null = null
    let bestD = maxDist
    for (const w of this.panes) {
      const dx = _l.x - (w.x + w.nx * 0.12)
      const dy = _l.y - w.y
      const dz = _l.z - (w.z + w.nz * 0.12)
      const along = dx * w.nx + dz * w.nz
      const lateral = Math.hypot(dx - along * w.nx, dz - along * w.nz)
      const d = Math.hypot(Math.max(0, lateral - w.w / 2), Math.max(0, Math.abs(dy) - w.h / 2), along)
      if (along > -0.05 && d < bestD) {
        bestD = d
        best = w
      }
    }
    if (!best) return null
    const lx = THREE.MathUtils.clamp(_l.x, best.x - Math.abs(best.nz) * best.w / 2, best.x + Math.abs(best.nz) * best.w / 2)
    const lz = THREE.MathUtils.clamp(_l.z, best.z - Math.abs(best.nx) * best.w / 2, best.z + Math.abs(best.nx) * best.w / 2)
    const ly = THREE.MathUtils.clamp(_l.y, best.y - best.h / 2, best.y + best.h / 2)
    const surf = toWorld(pose, { x: lx + best.nx * 0.12, y: ly, z: lz + best.nz * 0.12 })
    return { id: best.id, coat: this.coat(best.id), position: surf, normal: dirToWorld(pose, { x: best.nx, y: 0, z: best.nz }) }
  }

  update(dt: number, force = false): void {
    for (const m of this.paneMats) m.uniforms.uTime!.value += dt
    this.refresh -= dt
    if (force || this.refresh <= 0) {
      this.refresh = 0.5
      for (const id of this.slot.keys()) this.writeCoat(id)
      this.panes.forEach((p, i) => this.coneCoat.setX(i, this.coat(p.id)))
      this.coneCoat.needsUpdate = true
    }
    const render = this.ctx.services.render
    let sun = 0
    if (render) {
      const d = render.uniforms.uSunDir.value
      sun = THREE.MathUtils.clamp(d.y, 0, 1)
    } else {
      const h = this.ctx.state.time.hours
      sun = THREE.MathUtils.clamp(Math.sin(((h - 6) / 13) * Math.PI), 0, 1)
    }
    this.coneMat.uniforms.uStrength!.value = 0.04 + 0.2 * sun
    for (let i = 0; i < this.panes.length; i++) {
      const p = this.panes[i]!
      const s = this.slot.get(p.id)!
      const sway = this.quarter.swayOf(p.part)
      const vis = this.quarter.isPartVisible(p.part)
      _m2.multiplyMatrices(sway, this.base[i]!)
      if (!vis) _m2.makeScale(0, 0, 0)
      s.mesh.setMatrixAt(s.index, _m2)
      _m.multiplyMatrices(sway, this.coneBase[i]!)
      if (!this.quarter.isDetailVisible(p.part)) _m.makeScale(0, 0, 0)
      this.cones.setMatrixAt(i, _m)
    }
    this.round.instanceMatrix.needsUpdate = true
    this.rect.instanceMatrix.needsUpdate = true
    this.cones.instanceMatrix.needsUpdate = true
  }

  ids(): string[] {
    return this.panes.map((p) => p.id)
  }
}
