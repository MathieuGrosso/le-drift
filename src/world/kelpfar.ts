import * as THREE from 'three'
import { BLEU_EDGE, CEILING_Y, REGIONS } from '../core/layout'
import type { GameContext, QualityLevel } from '../core/types'
import { fbm } from './noise'
import { blancWeight, heightAt, routeDistance, smoothstep, VENT } from './terrain'

const CELL = 14
const SEGMENTS = 6
const SHARE: Record<QualityLevel, number> = { high: 1, medium: 0.7, low: 0.4 }

export function farKelpDensity(x: number, z: number): number {
  if (Math.abs(x) > BLEU_EDGE - 20 || Math.abs(z) > BLEU_EDGE - 20) return 0
  const lam = 1 - smoothstep(160, 400, Math.hypot(x - REGIONS.laminaires.x, z - REGIONS.laminaires.z))
  const dr = routeDistance(x, z)
  const band = smoothstep(150, 210, dr) * (1 - smoothstep(420, 520, dr))
  const groves = smoothstep(0.08, 0.42, fbm(x / 170, z / 170, 3, 151))
  const vent = 1 - smoothstep(200, 320, Math.hypot(x - VENT.x, z - VENT.z))
  return Math.max(lam * 0.95, band * groves * 0.85) * (1 - blancWeight(z)) * (1 - vent)
}

const VERTEX_DECL = /* glsl */ `
attribute vec3 aBase;
attribute vec2 aSize;
attribute float aSeed;
uniform float rdTime;
uniform vec3 rdCurrent;
varying vec2 vK;
varying float vSeedK;
varying float vDistK;
`

const VERTEX_BODY = /* glsl */ `
vec3 toCam = cameraPosition - aBase;
vec2 dir = normalize(toCam.xz + vec2(1e-4, 0.0));
vec3 right = vec3(-dir.y, 0.0, dir.x);
float v = position.y;
vec3 transformed = aBase + right * position.x * aSize.x + vec3(0.0, v * aSize.y, 0.0);
vec2 flow = rdCurrent.xz * 0.6 + vec2(0.35, -0.2);
float sway = sin(rdTime * 0.42 + aSeed * 37.0 + v * 2.2);
transformed.xz += (flow * 0.06 + vec2(sway, sway * 0.6) * 0.05) * v * v * aSize.y;
vK = vec2(position.x, v);
vSeedK = aSeed;
vDistK = length(toCam.xz);
`

const FRAGMENT_DECL = /* glsl */ `
varying vec2 vK;
varying float vSeedK;
varying float vDistK;
`

const FRAGMENT_BODY = /* glsl */ `
{
  float near = smoothstep(115.0, 175.0, vDistK);
  if (rd_hash(floor(gl_FragCoord.xy)) > near) discard;
  float cover = 0.0;
  float t = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float sk = fract(vSeedK * (7.13 + fk * 3.71) + fk * 0.37);
    float top = 0.6 + 0.4 * fract(sk * 13.1);
    float cx = (fk - 1.0) * 0.5 + (sk - 0.5) * 0.3;
    float tk = vK.y / top;
    if (tk > 1.0) continue;
    float x = vK.x - cx - sin(tk * 3.0 + sk * 6.28 + rdTime * 0.3) * 0.07 * tk;
    float stalk = step(abs(x), 0.03 * (1.0 - 0.4 * tk));
    float seg = vK.y * 15.0 + sk * 5.0;
    float side = mod(floor(seg), 2.0) * 2.0 - 1.0;
    float dx = x * side;
    float len = 0.26 * (0.35 + 0.65 * sin(3.1416 * min(tk * 1.15, 1.0))) + 0.02;
    float along = clamp(dx / len, 0.0, 1.0);
    float centre = 0.25 + along * 0.55;
    float blade = step(0.0, dx) * step(dx, len) * step(abs(fract(seg) - centre), 0.3 * (1.0 - along) + 0.04);
    float c = max(stalk, blade * step(0.06, tk));
    if (c > cover) { cover = c; t = tk; }
  }
  if (cover < 0.5) discard;
  vec3 base = mix(vec3(0.17, 0.16, 0.07), vec3(0.62, 0.52, 0.2), smoothstep(0.0, 0.9, t));
  float lit = mix(0.28, 1.0, rdDay);
  vec3 col = base * lit * (rdPlafond * 0.55 + 0.45);
  col += rdSunColor * rdSunI * 0.22 * t * t * vec3(1.0, 0.85, 0.45);
  outgoingLight = col;
  diffuseColor.a = 1.0;
}
#include <opaque_fragment>
`

// Kelp forests beyond flora's real stalks: camera-facing cards drawn from a procedural silhouette.
export class FarKelp {
  readonly mesh: THREE.Mesh
  private readonly geo: THREE.InstancedBufferGeometry
  private readonly total: number

  constructor(ctx: GameContext) {
    const rng = ctx.rng('world:kelp-far')
    const base: number[] = []
    const size: number[] = []
    const seed: number[] = []
    const extent = BLEU_EDGE - 20
    for (let z = -extent; z < extent; z += CELL) {
      for (let x = -extent; x < extent; x += CELL) {
        const px = x + rng() * CELL
        const pz = z + rng() * CELL
        const d = farKelpDensity(px, pz)
        const r = rng()
        if (r > d * 0.8) continue
        const floor = heightAt(px, pz)
        const room = CEILING_Y - 12 - floor
        if (room < 18) continue
        const h = Math.min(72, room) * (0.5 + 0.5 * rng())
        base.push(px, floor - 0.8, pz)
        size.push(h * (0.28 + 0.12 * rng()), h)
        seed.push(rng())
      }
    }
    this.total = seed.length
    const order = [...Array(this.total).keys()]
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    const pick = <T extends number>(src: T[], n: number) => {
      const out = new Float32Array(order.length * n)
      order.forEach((o, i) => {
        for (let c = 0; c < n; c++) out[i * n + c] = src[o * n + c]!
      })
      return out
    }

    const quad = new THREE.PlaneGeometry(2, 1, 1, SEGMENTS)
    quad.translate(0, 0.5, 0)
    this.geo = new THREE.InstancedBufferGeometry()
    this.geo.index = quad.index
    this.geo.setAttribute('position', quad.getAttribute('position'))
    this.geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(pick(base, 3), 3))
    this.geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(pick(size, 2), 2))
    this.geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(pick(seed, 1), 1))

    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    mat.customProgramCacheKey = () => 'world-kelp-far'
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY)
      shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader.replace('#include <opaque_fragment>', FRAGMENT_BODY)
    }
    ctx.services.render?.patchWater(mat)
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.name = 'world-kelp-far'
    this.mesh.frustumCulled = false
    this.setQuality(ctx.quality.level)
  }

  get count(): number {
    return this.total
  }

  setQuality(level: QualityLevel): void {
    this.geo.instanceCount = Math.floor(this.total * SHARE[level])
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.geo.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
