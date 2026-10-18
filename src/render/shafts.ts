import * as THREE from 'three'
import type { QualityLevel } from '../core/types'
import { GLSL_COMMON, GLSL_GLASS, GLSL_VERTEX } from './glsl'
import { MAX_GLASS, MAX_LAMPS, type AllUniforms } from './uniforms'

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
  if (rdIndoor > 0.5 && vViewZ < rdGlassDist + 0.4) discard;
  float sceneZ = rd_sceneViewZ();
  if (vViewZ > sceneZ) discard;
  if (rdIndoor > 0.01 && sceneZ < rdGlassDist + 6.0) discard;
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
varying vec3 vCol;
void main() {
  float slow = mix(1.0, 0.18, rdIndoor);
  vec3 drift = rdCurrent * rdTime * 0.6 * (1.0 - rdIndoor) + vec3(sin(rdTime * 0.2 * slow + aMote.w * 20.0), sin(rdTime * 0.13 * slow + aMote.w * 9.0) * 0.6, cos(rdTime * 0.17 * slow + aMote.w * 13.0));
  float box = mix(uBox, uBox * 0.35, rdIndoor);
  vec3 p = aMote.xyz * (box / uBox) + drift * mix(1.0, 0.5, rdIndoor);
  vec3 rel = mod(p - cameraPosition + box * 0.5, box) - box * 0.5;
  vec3 wp = cameraPosition + rel;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = length(rel);
  vViewZ = -mv.z;
  vA = smoothstep(0.4, 1.6, dist) * (1.0 - smoothstep(box * 0.3, box * 0.5, dist));
  vec3 outC = mix(rdPlafond * 0.55, rdSunColor * rdSunI, 0.35) * (0.35 + 0.65 * rdDay) + rdPlankton * vec3(0.25, 0.45, 0.15);
  vec3 inC = vec3(0.0);
  if (rdIndoor > 0.01) {
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      vec4 lp = rdLamps[i];
      if (lp.w <= 0.0) continue;
      float x = clamp(length(lp.xyz - wp) / (lp.w * 0.6), 0.0, 1.0);
      inC += rdLampColors[i] * (1.0 - x) * (1.0 - x) * 1.6;
    }
    float along;
    for (int i = 0; i < ${MAX_GLASS}; i++) inC += mix(rd_beamColor(), vec3(1.0, 0.93, 0.8) * dot(rd_beamColor(), vec3(0.4)), 0.5) * rd_beamAt(wp, i, along) * 4.5;
  }
  vCol = mix(outC, inC, rdIndoor);
  if (rdIndoor > 0.5 && vViewZ > rdGlassDist + 0.5) vCol = outC * 0.5;
  gl_PointSize = clamp(uPx * (0.03 + aMote.w * 0.05) * mix(1.0, 0.45, rdIndoor) / max(vViewZ, 0.1), 1.0, 9.0);
}
`

const MOTE_FS = /* glsl */ `
varying float vA;
varying float vViewZ;
varying vec3 vCol;
void main() {
  float sz = rd_sceneViewZ();
  if (vViewZ > sz) discard;
  if (rdIndoor > 0.5 && vViewZ > rdGlassDist + 0.5 && sz < rdGlassDist + 6.0) discard;
  vec2 q = gl_PointCoord - 0.5;
  float r = 1.0 - smoothstep(0.15, 0.5, length(q));
  float tw = mix(1.0, 0.6 + 0.4 * sin(rdTime * 2.0 + gl_FragCoord.x * 0.37), rdIndoor);
  gl_FragColor = vec4(vCol * r * vA * 0.32 * tw, 1.0);
}
`

const VOL_VS = /* glsl */ `
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec3 vRay;
void main() {
  vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);
  vRay = (uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const VOL_FS = /* glsl */ `
uniform vec3 uCamFwd;
uniform float uBeams;
uniform float uHalos;
varying vec3 vRay;
void main() {
  vec3 rd = normalize(vRay);
  float viewZ = rd_sceneViewZ();
  float dist = min(viewZ / max(dot(rd, uCamFwd), 0.05), 60.0);
  float glassCut = rdGlassDist + 0.3;
  vec3 col = vec3(0.0);
  if (uBeams > 0.5) {
    float span = min(dist, max(glassCut, 2.0) + 18.0);
    const int STEPS = 28;
    float jit = 0.5 + 0.25 * (fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)) * 52.9829189) - 0.5);
    float stepL = span / float(STEPS);
    float acc = 0.0;
    for (int s = 0; s < STEPS; s++) {
      float t = (float(s) + jit) * stepL;
      vec3 P = cameraPosition + rd * t;
      float along;
      float b = 0.0;
      for (int i = 0; i < ${MAX_GLASS}; i++) b += rd_beamAt(P, i, along);
      if (b > 0.0) {
        float dust = 0.6 + 0.4 * rd_noise(P.xz * 1.7 + P.y * 0.9 + vec2(rdTime * 0.05, rdTime * 0.03));
        acc += b * dust * stepL * smoothstep(0.2, 1.2, t);
      }
    }
    vec3 bc = rd_beamColor();
    bc = mix(bc, vec3(0.78, 1.0, 0.93) * dot(bc, vec3(0.33)), 0.45);
    bc = mix(bc, vec3(dot(bc, vec3(0.33))) * vec3(1.06, 1.0, 0.88), 0.5);
    col += bc * min((1.0 - exp(-acc * 1.5)) * 0.3, 0.09);
  }
  if (uHalos > 0.5) {
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      vec4 lp = rdLamps[i];
      if (lp.w <= 0.0) continue;
      vec3 rel = lp.xyz - cameraPosition;
      float s = clamp(dot(rel, rd), 0.0, dist);
      float behind = step(dot(rel, rd) - 0.4, dist);
      vec3 q = rel - rd * s;
      float d2 = dot(q, q);
      float far = 1.0 / (1.0 + dot(rel, rel) * 0.004);
      float L = length(rel);
      float nearK = smoothstep(1.5, 6.0, L);
      float h = exp(-d2 * max(18.0, 900.0 / max(L * L, 0.01))) * 0.5 * behind + (exp(-d2 * 1.4) * 0.03 + exp(-d2 * 0.2) * 0.002) * rdAirHaze * nearK;
      col += mix(vec3(1.0), rdLampColors[i], 0.75) * h * far;
    }
  }
  gl_FragColor = vec4(col * rdIndoor, 1.0);
}
`

export interface Shafts {
  scene: THREE.Scene
  setQuality(level: QualityLevel): void
  bindDepth(depth: THREE.Texture, w: number, h: number, near: number, far: number): void
  setStrength(s: number): void
  setCamera(camera: THREE.PerspectiveCamera, beams: boolean, halos: boolean): void
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
    vertexShader: GLSL_VERTEX + GLSL_GLASS + MOTE_VS,
    fragmentShader: GLSL_COMMON + DEPTH_GLSL + MOTE_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  const volUniforms = {
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
    uBeams: { value: 0 },
    uHalos: { value: 0 },
  }
  const volMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...depthUniforms, ...volUniforms },
    vertexShader: VOL_VS,
    fragmentShader: GLSL_COMMON + DEPTH_GLSL + VOL_FS,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  const volGeo = new THREE.BufferGeometry()
  volGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const vol = new THREE.Mesh(volGeo, volMat)
  vol.frustumCulled = false
  vol.renderOrder = 10
  vol.visible = false
  scene.add(vol)
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
    setCamera(camera, beams, halos) {
      volUniforms.uInvProj.value.copy(camera.projectionMatrixInverse)
      volUniforms.uCamWorld.value.copy(camera.matrixWorld)
      camera.getWorldDirection(volUniforms.uCamFwd.value)
      volUniforms.uBeams.value = beams ? 1 : 0
      volUniforms.uHalos.value = halos ? 1 : 0
      vol.visible = beams || halos
    },
    dispose() {
      volGeo.dispose()
      volMat.dispose()
      shaftMesh?.geometry.dispose()
      motes?.geometry.dispose()
      shaftMat.dispose()
      moteMat.dispose()
    },
  }
}
