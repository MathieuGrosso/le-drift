import * as THREE from 'three'
import type { CelMaterialParams, GameContext } from '../core/types'

export interface Mats {
  cel(p: CelMaterialParams): THREE.Material
  water<T extends THREE.Material>(m: T): T
  fallback: boolean
}

export function createMats(ctx: GameContext): Mats {
  const render = ctx.services.render
  const cache = new Map<string, THREE.Material>()
  return {
    fallback: !render,
    cel(p) {
      const key = p.map || p.onShader ? '' : JSON.stringify(p)
      if (key) {
        const hit = cache.get(key)
        if (hit) return hit
      }
      let m: THREE.Material
      if (render) {
        try {
          m = render.cel(p)
        } catch (err) {
          console.error('[drift] cel failed', err)
          m = lambert(p)
        }
      } else {
        m = lambert(p)
      }
      if (key) cache.set(key, m)
      return m
    },
    water(m) {
      if (render) {
        try {
          render.patchWater(m)
        } catch (err) {
          console.warn('[drift] patchWater failed', err)
        }
      }
      return m
    },
  }
}

function lambert(p: CelMaterialParams): THREE.Material {
  const m = new THREE.MeshLambertMaterial({
    color: p.color,
    vertexColors: p.vertexColors ?? false,
    transparent: p.transparent ?? false,
    side: p.side ?? THREE.FrontSide,
  })
  if (p.map) m.map = p.map
  if (p.emissive !== undefined) m.emissive = new THREE.Color(p.emissive)
  return m
}

export const NOISE_GLSL = /* glsl */ `
float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dHash(i), dHash(i + vec2(1.0, 0.0)), u.x), mix(dHash(i + vec2(0.0, 1.0)), dHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float dFbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * dNoise(p); p *= 2.07; a *= 0.5; }
  return v;
}
`
