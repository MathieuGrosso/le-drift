import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { CEILING_Y, LANDMARKS, SONDES } from '../core/layout'
import type { GameContext } from '../core/types'
import { valueNoise } from './noise'
import { rockColor } from './rocks'
import { PAL, makeMaterial } from './surface'
import { blancWeight, heightAt, smoothstep, VENT } from './terrain'
import { SEABED_COLLIDERS } from './chunks'
import { driftDeepShader } from './shade'

interface ArchDef { id: string; x: number; z: number; radius: number; tube: number; yaw: number }

export const ARCHES: readonly ArchDef[] = [
  { id: 'arche-cadre', x: -170, z: 540, radius: 22, tube: 5, yaw: 2.76 },
  { id: 'arche-pilier-1', x: -140, z: 60, radius: 24, tube: 6, yaw: 0.4 },
  { id: 'arche-pilier-2', x: 110, z: -120, radius: 30, tube: 7, yaw: 1.2 },
  { id: 'arche-pilier-3', x: 150, z: 150, radius: 18, tube: 5, yaw: -0.6 },
  { id: 'arche-pilier-4', x: -60, z: -210, radius: 26, tube: 6, yaw: 2.0 },
  { id: 'arche-laminaires', x: -430, z: 120, radius: 20, tube: 5, yaw: 0.9 },
  { id: 'arche-coques', x: 470, z: -610, radius: 26, tube: 6, yaw: 0.3 },
  { id: 'arche-cheminee', x: 690, z: 500, radius: 20, tube: 6, yaw: 0.8 },
  { id: 'arche-blanc', x: -300, z: -820, radius: 18, tube: 5, yaw: 0.2 },
]

const SMOKER_COUNT = 22

export class Landmarks {
  readonly group = new THREE.Group()
  private body: RAPIER.RigidBody | null = null
  private readonly colliders: RAPIER.Collider[] = []
  private readonly plumeUniforms = { uTime: { value: 0 } }
  private readonly disposables: { dispose(): void }[] = []

  constructor(private readonly ctx: GameContext) {
    this.group.name = 'world-landmarks'
    const R = ctx.physics.rapier
    this.body = ctx.physics.world.createRigidBody(R.RigidBodyDesc.fixed())
    this.buildArches()
    this.buildSmokers()
    this.buildPlume()
  }

  update(elapsed: number): void {
    this.plumeUniforms.uTime.value = elapsed
  }

  private groups(): number {
    return ((this.ctx.physics.groups.TERRAIN & 0xffff) << 16) | 0xffff
  }

  private buildArches(): void {
    const positions: number[] = []
    const normals: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const v = new THREE.Vector3()
    const n = new THREE.Vector3()
    const col = new THREE.Color()
    const moss = new THREE.Color().copy(PAL.herbe).lerp(PAL.herbeOmbre, 0.5)
    const R = this.ctx.physics.rapier

    ARCHES.forEach((a, ai) => {
      const geo = new THREE.TorusGeometry(a.radius, a.tube, 9, 40)
      const pos = geo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        const ang = Math.atan2(v.y, v.x)
        const cx = Math.cos(ang) * a.radius
        const cy = Math.sin(ang) * a.radius
        const k = 1 + 0.32 * valueNoise(v.x / 5 + ai * 9, v.y / 5 + v.z / 4, 401) + 0.12 * valueNoise(v.x / 1.8, v.y / 1.8 + v.z, 403)
        const thick = 1 + 0.35 * Math.max(0, -Math.sin(ang))
        v.set(cx + (v.x - cx) * k * thick, cy + (v.y - cy) * k * thick, v.z * k * thick)
        pos.setXYZ(i, v.x, v.y, v.z)
      }
      geo.computeVertexNormals()
      const cos = Math.cos(a.yaw)
      const sin = Math.sin(a.yaw)
      const f1 = heightAt(a.x + cos * a.radius, a.z - sin * a.radius)
      const f2 = heightAt(a.x - cos * a.radius, a.z + sin * a.radius)
      const baseY = Math.min(f1, f2) - a.radius * 0.22
      const m = new THREE.Matrix4().makeRotationY(a.yaw).setPosition(a.x, baseY, a.z)
      geo.applyMatrix4(m)
      const gp = geo.getAttribute('position') as THREE.BufferAttribute
      const gn = geo.getAttribute('normal') as THREE.BufferAttribute
      const offset = positions.length / 3
      const base = rockColor(a.x, a.z, new THREE.Color(), 0.4)
      const pale = blancWeight(a.z) > 0.5
      for (let i = 0; i < gp.count; i++) {
        v.fromBufferAttribute(gp, i)
        n.fromBufferAttribute(gn, i)
        positions.push(v.x, v.y, v.z)
        normals.push(n.x, n.y, n.z)
        col.copy(base)
        if (!pale) col.lerp(moss, smoothstep(0.45, 0.8, n.y) * 0.7)
        col.multiplyScalar(0.9 + 0.12 * valueNoise(v.x / 3, v.z / 3 + v.y / 3, 405))
        colors.push(col.r, col.g, col.b)
      }
      const idx = geo.getIndex()!
      const local: number[] = []
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + offset)
        local.push(idx.getX(i))
      }
      if (SEABED_COLLIDERS) {
        const desc = R.ColliderDesc.trimesh(new Float32Array(gp.array), new Uint32Array(local)).setCollisionGroups(this.groups())
        const c = this.ctx.physics.world.createCollider(desc, this.body!)
        this.ctx.physics.tag(c, { kind: 'rock', climbable: true, ownerId: a.id })
        this.colliders.push(c)
      }
      geo.dispose()
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.setIndex(indices)
    geo.computeBoundingSphere()
    const mat = makeMaterial(this.ctx, { color: 0xffffff, vertexColors: true, onShader: driftDeepShader })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.name = 'world-arches'
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
    this.disposables.push(geo, mat)
  }

  private buildSmokers(): void {
    const rng = this.ctx.rng('world:smokers')
    const R = this.ctx.physics.rapier
    const geo = new THREE.CylinderGeometry(0.45, 1, 1, 7, 3)
    geo.translate(0, 0.5, 0)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const w = 1 + 0.25 * valueNoise(pos.getX(i) * 3 + y * 5, pos.getZ(i) * 3, 411)
      pos.setX(i, pos.getX(i) * w)
      pos.setZ(i, pos.getZ(i) * w)
    }
    geo.computeVertexNormals()
    const tipGeo = new THREE.IcosahedronGeometry(1, 1)
    const mat = makeMaterial(this.ctx, { color: PAL.fumee.getHex(), onShader: driftDeepShader })
    const tipMat = makeMaterial(this.ctx, { color: 0xff8a4c, emissive: 0xff8a4c })
    const mesh = new THREE.InstancedMesh(geo, mat, SMOKER_COUNT)
    const tips = new THREE.InstancedMesh(tipGeo, tipMat, SMOKER_COUNT)
    mesh.name = 'world-smokers'
    tips.name = 'world-smoker-tips'
    mesh.castShadow = true
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const sonde = SONDES.find((d) => d.id === 'sonde-cheminee')
    let placed = 0
    for (let tries = 0; tries < 200 && placed < SMOKER_COUNT; tries++) {
      const ang = rng() * Math.PI * 2
      const r = 60 + rng() * 150
      const x = VENT.x + Math.cos(ang) * r
      const z = VENT.z + Math.sin(ang) * r
      const h = 6 + rng() * 12
      const rad = 1.3 + rng() * 1.4
      if (sonde && Math.hypot(x - sonde.x, z - sonde.z) < 30) continue
      if (x > 950) continue
      const y = heightAt(x, z) - 0.8
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2)
      mesh.setMatrixAt(placed, m.compose(p.set(x, y, z), q, s.set(rad, h, rad)))
      tips.setMatrixAt(placed, m.compose(p.set(x, y + h, z), q, s.set(rad * 0.5, rad * 0.35, rad * 0.5)))
      if (SEABED_COLLIDERS) {
        const c = this.ctx.physics.world.createCollider(
          R.ColliderDesc.cylinder(h / 2, rad * 0.8).setTranslation(x, y + h / 2, z).setCollisionGroups(this.groups()),
          this.body!,
        )
        this.ctx.physics.tag(c, { kind: 'rock', climbable: true, ownerId: `fumeur-${placed}` })
        this.colliders.push(c)
      }
      placed++
    }
    mesh.count = placed
    tips.count = placed
    mesh.computeBoundingSphere()
    tips.computeBoundingSphere()
    this.group.add(mesh, tips)
    this.disposables.push(geo, tipGeo, mat, tipMat, mesh, tips)
  }

  private buildPlume(): void {
    const baseY = heightAt(VENT.x, VENT.z) - 2
    const height = CEILING_Y - baseY + 2
    const { radiusBottom, radiusTop } = LANDMARKS.panache
    const make = (scale: number, opacity: number, heartBoost: number) => {
      const geo = new THREE.CylinderGeometry(radiusTop * scale, radiusBottom * scale, height, 40, 1, true)
      geo.translate(0, height / 2, 0)
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.plumeUniforms.uTime,
          uHeart: { value: new THREE.Color(0xff8a4c) },
          uSmoke: { value: new THREE.Color(0x6a5770) },
          uTop: { value: new THREE.Color(0xa898ad) },
          uOpacity: { value: opacity },
          uHeartBoost: { value: heartBoost },
          uHaze: { value: new THREE.Color(0x7cc6bf) },
        },
        vertexShader: PLUME_VERT,
        fragmentShader: PLUME_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(VENT.x, baseY, VENT.z)
      mesh.renderOrder = 2
      mesh.name = 'world-plume'
      this.group.add(mesh)
      this.disposables.push(geo, mat)
    }
    make(1, 0.75, 0.6)
    make(0.55, 0.95, 1.2)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const g = canvas.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, 'rgba(255,200,140,1)')
      grad.addColorStop(0.35, 'rgba(255,138,76,0.55)')
      grad.addColorStop(1, 'rgba(255,138,76,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const smat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 })
    const glow = new THREE.Sprite(smat)
    glow.position.set(VENT.x, baseY + 8, VENT.z)
    glow.scale.setScalar(90)
    glow.name = 'world-plume-glow'
    this.group.add(glow)
    this.disposables.push(tex, smat)
  }

  dispose(): void {
    for (const c of this.colliders) this.ctx.physics.untag(c)
    if (this.body) this.ctx.physics.world.removeRigidBody(this.body)
    this.body = null
    for (const d of this.disposables) d.dispose()
    this.group.removeFromParent()
  }
}

const PLUME_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
void main() {
  vUv = uv;
  vec3 p = position;
  float k = uv.y;
  p.x += (sin(k * 6.0 + uTime * 0.3) * 4.0 + sin(k * 13.0 - uTime * 0.5) * 1.5) * k;
  p.z += cos(k * 5.0 + uTime * 0.25) * 4.0 * k;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const PLUME_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uHeart;
uniform vec3 uSmoke;
uniform vec3 uTop;
uniform float uOpacity;
uniform float uHeartBoost;
uniform vec3 uHaze;
varying vec2 vUv;
varying vec3 vW;
varying vec3 vN;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(abs(dot(normalize(vN), V)), 0.8);
  vec2 q = vec2((vW.x - vW.z) * 0.05, vW.y * 0.03 - uTime * 0.12);
  float n = vnoise(q) * 0.6 + vnoise(q * 2.3 + 7.0) * 0.4;
  float a = fres * (0.3 + 0.7 * n) * smoothstep(0.0, 0.04, vUv.y) * (1.0 - 0.55 * smoothstep(0.7, 1.0, vUv.y));
  vec3 col = mix(uHeart, uSmoke, smoothstep(0.0, 0.25, vUv.y));
  col = mix(col, uTop, smoothstep(0.45, 1.0, vUv.y));
  col += uHeart * (1.0 - smoothstep(0.0, 0.15, vUv.y)) * uHeartBoost;
  float hz = min(1.0 - exp(-length(cameraPosition - vW) / 1400.0), 0.4);
  col = mix(col, uHaze, hz);
  gl_FragColor = vec4(col, min(1.0, a * uOpacity * (1.0 + hz)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
