import * as THREE from 'three'
import type { QualityLevel } from '../core/types'
import { GLSL_COMMON, GLSL_VERTEX } from './glsl'
import type { AllUniforms } from './uniforms'

const TILE = 420
const SHAFTS: Record<QualityLevel, number> = { high: 140, medium: 100, low: 55 }
const MOTES: Record<QualityLevel, number> = { high: 2200, medium: 1400, low: 700 }
const MOTE_BOX = 46

const DEPTH_GLSL = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
float rd_sceneViewZ() {
  float d = texture2D(tDepth, gl_FragCoord.xy / uRes).r;
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
`

const SHAFT_VS = /* glsl */ `
attribute vec4 aShaft;
uniform float uTile;
varying vec2 vQ;
varying float vViewZ;
varying float vFade;
varying float vSeed;
varying float vY;
void main() {
  vec2 c = cameraPosition.xz;
  vec3 L = normalize(rdSunDir);
  float eyeY = clamp(cameraPosition.y, 5.0, rdCeilY - 10.0);
  vec2 run = L.xz / max(L.y, 0.25) * (rdCeilY - eyeY);
  vec2 anchor = aShaft.xy + uTile * floor((c - aShaft.xy) / uTile + 0.5);
  float sway = sin(rdTime * 0.13 + aShaft.w * 40.0) * 6.0;
  vec3 top = vec3(anchor.x + run.x + sway, rdCeilY, anchor.y + run.y + sway * 0.5);
  float len = (rdCeilY + 10.0) / max(L.y, 0.25);
  vec3 axisPt = top - L * len * position.y;
  vec3 toCam = normalize(cameraPosition - axisPt);
  vec3 side = normalize(cross(L, toCam));
  vec3 wp = axisPt + side * position.x * aShaft.z;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vQ = position.xy;
  vViewZ = -mv.z;
  vSeed = aShaft.w;
  vY = wp.y;
  float wrapFade = 1.0 - smoothstep(uTile * 0.3, uTile * 0.5, length(anchor - c));
  float edgeOn = 1.0 - abs(dot(toCam, L));
  vFade = smoothstep(0.05, 0.35, edgeOn) * wrapFade;
}
`

const SHAFT_FS = /* glsl */ `
varying vec2 vQ;
varying float vViewZ;
varying float vFade;
varying float vSeed;
varying float vY;
uniform float uStrength;
void main() {
  float sceneZ = rd_sceneViewZ();
  if (vViewZ > sceneZ) discard;
  float soft = smoothstep(0.0, 8.0, sceneZ - vViewZ) * smoothstep(2.0, 14.0, vViewZ);
  float across = 1.0 - abs(vQ.x) * 2.0;
  across = across * across * (3.0 - 2.0 * across);
  float along = pow(1.0 - vQ.y, 1.4) * smoothstep(0.0, 0.04, vQ.y);
  float flick = 0.55 + 0.45 * sin(rdTime * (0.35 + vSeed * 0.4) + vSeed * 31.0);
  float streak = 0.75 + 0.25 * rd_noise(vec2(vQ.x * 5.0 + vSeed * 10.0, vQ.y * 2.0 - rdTime * 0.05));
  float low = smoothstep(-20.0, 30.0, vY);
  float hz = rd_hazeAmount(vViewZ);
  float a = across * along * flick * streak * soft * vFade * low * (1.0 - hz * 0.75);
  vec3 col = mix(rdPlafond, rdSunColor, 0.55) * rdSunI * rdDay;
  gl_FragColor = vec4(col * a * uStrength, 1.0);
}
`

const MOTE_VS = /* glsl */ `
attribute vec4 aMote;
uniform float uBox;
uniform float uPx;
varying float vA;
varying float vViewZ;
void main() {
  vec3 drift = rdCurrent * rdTime * 0.6 + vec3(sin(rdTime * 0.2 + aMote.w * 20.0), sin(rdTime * 0.13 + aMote.w * 9.0) * 0.6, cos(rdTime * 0.17 + aMote.w * 13.0));
  vec3 p = aMote.xyz + drift;
  vec3 rel = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 wp = cameraPosition + rel;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = length(rel);
  vViewZ = -mv.z;
  vA = smoothstep(0.6, 2.5, dist) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist));
  gl_PointSize = clamp(uPx * (0.03 + aMote.w * 0.05) / max(vViewZ, 0.1), 1.0, 9.0);
}
`

const MOTE_FS = /* glsl */ `
varying float vA;
varying float vViewZ;
void main() {
  if (vViewZ > rd_sceneViewZ()) discard;
  vec2 q = gl_PointCoord - 0.5;
  float r = 1.0 - smoothstep(0.15, 0.5, length(q));
  vec3 col = mix(rdPlafond * 0.55, rdSunColor * rdSunI, 0.35) * (0.35 + 0.65 * rdDay);
  col += rdPlankton * vec3(0.25, 0.45, 0.15);
  gl_FragColor = vec4(col * r * vA * 0.32, 1.0);
}
`

export interface Shafts {
  scene: THREE.Scene
  setQuality(level: QualityLevel): void
  bindDepth(depth: THREE.Texture, w: number, h: number, near: number, far: number): void
  setStrength(s: number): void
  dispose(): void
}

function buildShaftGeometry(count: number, rng: () => number): THREE.InstancedBufferGeometry {
  const quad = new THREE.PlaneGeometry(1, 1, 1, 8)
  quad.translate(0, 0.5, 0)
  const pos = quad.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) pos.setY(i, 1 - pos.getY(i))
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = quad.index
  geo.setAttribute('position', pos)
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    data[i * 4] = rng() * TILE
    data[i * 4 + 1] = rng() * TILE
    data[i * 4 + 2] = 5 + rng() * rng() * 22
    data[i * 4 + 3] = rng()
  }
  geo.setAttribute('aShaft', new THREE.InstancedBufferAttribute(data, 4))
  geo.instanceCount = count
  return geo
}

function buildMoteGeometry(count: number, rng: () => number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const data = new Float32Array(count * 4)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    data[i * 4] = rng() * MOTE_BOX
    data[i * 4 + 1] = rng() * MOTE_BOX
    data[i * 4 + 2] = rng() * MOTE_BOX
    data[i * 4 + 3] = rng()
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aMote', new THREE.BufferAttribute(data, 4))
  return geo
}

export function createShafts(shared: AllUniforms, rng: () => number, level: QualityLevel): Shafts {
  const scene = new THREE.Scene()
  const depthUniforms = {
    tDepth: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 4000 },
  }
  const strength = { value: 0.22 }
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...depthUniforms, uTile: { value: TILE }, uStrength: strength },
    vertexShader: GLSL_VERTEX + SHAFT_VS,
    fragmentShader: GLSL_COMMON + DEPTH_GLSL + SHAFT_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const pxUniform = { value: 600 }
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...depthUniforms, uBox: { value: MOTE_BOX }, uPx: pxUniform },
    vertexShader: GLSL_VERTEX + MOTE_VS,
    fragmentShader: GLSL_COMMON + DEPTH_GLSL + MOTE_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  let shaftMesh: THREE.Mesh | null = null
  let motes: THREE.Points | null = null

  const build = (q: QualityLevel) => {
    if (shaftMesh) {
      scene.remove(shaftMesh)
      shaftMesh.geometry.dispose()
    }
    if (motes) {
      scene.remove(motes)
      motes.geometry.dispose()
    }
    shaftMesh = new THREE.Mesh(buildShaftGeometry(SHAFTS[q], rng), shaftMat)
    shaftMesh.frustumCulled = false
    motes = new THREE.Points(buildMoteGeometry(MOTES[q], rng), moteMat)
    motes.frustumCulled = false
    scene.add(shaftMesh, motes)
  }
  build(level)

  return {
    scene,
    setQuality: build,
    bindDepth(depth, w, h, near, far) {
      depthUniforms.tDepth.value = depth
      depthUniforms.uRes.value.set(w, h)
      depthUniforms.uNear.value = near
      depthUniforms.uFar.value = far
      pxUniform.value = h * 1.2
    },
    setStrength(s) {
      strength.value = s
    },
    dispose() {
      shaftMesh?.geometry.dispose()
      motes?.geometry.dispose()
      shaftMat.dispose()
      moteMat.dispose()
    },
  }
}
