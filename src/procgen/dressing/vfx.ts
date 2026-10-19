import * as THREE from 'three'
import type { Emitter, EmitterKind } from './plan'

const KIND: Record<EmitterKind, number> = { vapeur: 0, poussiere: 1, gouttes: 2, etincelles: 3, bulles: 4, braises: 5 }
const FROM_TOP: ReadonlySet<EmitterKind> = new Set(['gouttes'])
const SCATTER: ReadonlySet<EmitterKind> = new Set(['poussiere'])

const VERT = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute float aSpan;
uniform float uTime;
uniform float uBurst;
uniform float uScale;
varying vec4 vCol;
void main() {
  vec3 p = position;
  float s = aSeed * 31.7;
  float k = aKind;
  float size = 0.05;
  vec4 col = vec4(1.0);
  if (k < 0.5) {
    float ph = fract(uTime * 0.07 + aSeed);
    p.y += ph * aSpan;
    p.x += sin(uTime * 0.6 + s) * 0.5 * ph;
    p.z += cos(uTime * 0.5 + s) * 0.5 * ph;
    size = mix(0.4, 1.5, ph);
    col = vec4(0.97, 0.95, 0.92, sin(ph * 3.14159) * (0.07 + 0.18 * uBurst));
  } else if (k < 1.5) {
    p += vec3(sin(uTime * 0.11 + s), sin(uTime * 0.07 + s * 1.3) * 0.6, cos(uTime * 0.09 + s * 0.7)) * 0.9;
    size = 0.035;
    col = vec4(1.0, 0.9, 0.7, 0.35 + 0.35 * sin(uTime * 1.3 + s));
  } else if (k < 2.5) {
    float ph = fract(uTime * 0.45 + aSeed);
    p.y -= ph * ph * aSpan;
    size = 0.04;
    col = vec4(0.8, 0.95, 1.0, 0.7 * (1.0 - ph));
  } else if (k < 3.5) {
    float ph = fract(uTime * 0.8 + aSeed);
    p.y += (ph * 2.6 - ph * ph * 3.2) * 1.4;
    p.x += sin(s) * ph * 1.2;
    p.z += cos(s) * ph * 1.2;
    size = 0.045;
    col = vec4(1.0, 0.65, 0.3, (1.0 - ph) * step(0.35, fract(aSeed * 7.0 + floor(uTime * 0.8 + aSeed))));
  } else if (k < 4.5) {
    float ph = fract(uTime * 0.18 + aSeed);
    p.y += ph * aSpan;
    p.x += sin(uTime * 2.0 + s) * 0.05;
    size = 0.05 + ph * 0.03;
    col = vec4(0.85, 0.97, 1.0, 0.55 * sin(ph * 3.14159));
  } else {
    float ph = fract(uTime * 0.05 + aSeed);
    p.y += ph * aSpan;
    p.x += sin(uTime * 0.4 + s) * 0.8;
    size = 0.035;
    col = vec4(1.0, 0.55, 0.25, (0.5 + 0.5 * sin(uTime * 3.0 + s)) * (1.0 - ph));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 1.0, 256.0);
  vCol = col;
}`

const FRAG = /* glsl */ `
varying vec4 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  float a = vCol.a * (1.0 - smoothstep(0.2, 1.0, r));
  if (a < 0.01) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`

export interface VfxUniforms { uTime: { value: number }; uBurst: { value: number }; uScale: { value: number } }

function material(u: VfxUniforms, additive: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: u as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}

// Two point clouds per district: soft veils (steam) blended normally, sparks and motes added.
export function buildVfx(emitters: readonly Emitter[], scale: number, rng: () => number, u: VfxUniforms): THREE.Points[] {
  const out: THREE.Points[] = []
  for (const additive of [false, true]) {
    const list = emitters.filter((e) => (e.kind !== 'vapeur') === additive)
    const n = list.reduce((s, e) => s + Math.round(e.count * scale), 0)
    if (n === 0) continue
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const kind = new Float32Array(n)
    const span = new Float32Array(n)
    let i = 0
    for (const e of list) {
      const c = Math.round(e.count * scale)
      const b = e.box
      for (let j = 0; j < c; j++, i++) {
        pos[i * 3] = b.x0 + rng() * (b.x1 - b.x0)
        pos[i * 3 + 1] = SCATTER.has(e.kind) ? b.y0 + rng() * (b.y1 - b.y0) : FROM_TOP.has(e.kind) ? b.y1 : b.y0
        pos[i * 3 + 2] = b.z0 + rng() * (b.z1 - b.z0)
        seed[i] = rng()
        kind[i] = KIND[e.kind]
        span[i] = b.y1 - b.y0
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1))
    g.setAttribute('aSpan', new THREE.BufferAttribute(span, 1))
    g.computeBoundingSphere()
    if (g.boundingSphere) g.boundingSphere.radius += 4
    const pts = new THREE.Points(g, material(u, additive))
    pts.name = additive ? 'vfx:eclats' : 'vfx:voiles'
    pts.frustumCulled = true
    out.push(pts)
  }
  return out
}
