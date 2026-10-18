import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import type { GameContext } from '../core/types'

const MID = new THREE.Color(0x3a8c98)
const DEEP = new THREE.Color(0x1b5e73)
const TOP = new THREE.Color(0x7cc6bf)
const PALE = new THREE.Color(0xcfefe3)
const NIGHT = new THREE.Color(0x0c2a40)
const START = 7
const DOME_R = 700
const LENGTHS: readonly [number, number][] = [[30, 40], [60, 70], [90, 100], [999, 165]]
const PERIOD = 64

const ratio = (c: THREE.Color) => `vec3(${(c.r / MID.r).toFixed(4)}, ${(c.g / MID.g).toFixed(4)}, ${(c.b / MID.b).toFixed(4)})`

// Shared by the sortie fog and the water dome so that a hazed hull melts into the water behind it.
const GRADIENT = /* glsl */ `
vec3 sv_grad(vec3 v, float worldY, vec3 mid) {
  vec3 c = mix(mid, mid * ${ratio(TOP)}, smoothstep(0.02, 0.8, v.y));
  c = mix(c, mid * ${ratio(DEEP)}, smoothstep(0.0, -0.55, v.y));
  c = mix(c, mid * ${ratio(DEEP)} * 0.62, smoothstep(-0.45, -0.95, v.y));
  float sv_d = clamp((${CEILING_Y.toFixed(1)} - worldY) / ${CEILING_Y.toFixed(1)}, 0.0, 1.0);
  return c * mix(1.1, 0.72, sv_d);
}
float sv_caus(vec2 p, float t) {
  const float w = ${((Math.PI * 2) / PERIOD).toFixed(6)};
  vec2 q = p + vec2(sin(p.y * 0.8 + t * w * 6.0), sin(p.x * 0.9 - t * w * 7.0)) * 0.9;
  float a = sin(q.x * 1.3 + t * w * 9.0) + sin(q.y * 1.1 - t * w * 5.0);
  float b = sin((q.x + q.y) * 0.9 + t * w * 4.0);
  return pow(1.0 - clamp(abs(a + b) / 3.0, 0.0, 1.0), 9.0);
}
`

const FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vSeaW;
#endif
`
const FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vSeaW = (mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix);
#endif
`
const FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vSeaW;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${GRADIENT}
#endif
`
// Linear fog is the sortie water: fogNear = clear radius, floor(fogFar) = haze length, fract(fogFar) = caustic clock.
const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth));
  #else
  {
    vec3 svD = vSeaW - cameraPosition;
    float svL = length(svD);
    vec3 svV = svD / max(svL, 1e-3);
    float svF = min(1.0 - exp(-pow(max(svL - fogNear, 0.0) / max(floor(fogFar), 1.0), 1.25)), 0.94);
    float svDay = clamp(fogColor.g / ${MID.g.toFixed(4)}, 0.0, 1.0);
    vec3 svN = normalize(cross(dFdx(vSeaW), dFdy(vSeaW)));
    vec2 svT = normalize(vec2(-svN.z, svN.x) + 1e-4);
    vec2 svP = mix(vec2(dot(vSeaW.xz, svT), vSeaW.y), vSeaW.xz, smoothstep(0.5, 0.9, abs(svN.y))) * 0.85;
    float svK = (1.0 - smoothstep(16.0, 40.0, svL)) * smoothstep(-0.5, 0.2, svN.y) * svDay;
    svK *= mix(0.45, 1.0, clamp((vSeaW.y - 20.0) / ${(CEILING_Y - 20).toFixed(1)}, 0.0, 1.0));
    if (svK > 0.01) gl_FragColor.rgb *= 1.0 + sv_caus(svP, fract(fogFar) * ${PERIOD.toFixed(1)}) * 1.1 * svK;
    float svBelow = clamp((cameraPosition.y - vSeaW.y) / 35.0, 0.0, 1.0);
    gl_FragColor.rgb *= mix(vec3(1.0), vec3(0.62, 0.84, 0.95), svBelow * 0.6);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, sv_grad(svV, vSeaW.y, fogColor), svF);
  }
  #endif
#endif
`

let installed = false
function installChunks(): void {
  if (installed) return
  installed = true
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>
  chunks.fog_pars_vertex = FOG_PARS_VERTEX
  chunks.fog_vertex = FOG_VERTEX
  chunks.fog_pars_fragment = FOG_PARS_FRAGMENT
  chunks.fog_fragment = FOG_FRAGMENT
}

const DOME_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const DOME_FS = /* glsl */ `
uniform vec3 uMid;
uniform vec3 uPale;
uniform vec3 uSun;
uniform float uDay;
uniform float uTime;
uniform float uEyeY;
varying vec3 vDir;
${GRADIENT}
float sv_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sv_n(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sv_h(i), sv_h(i + vec2(1.0, 0.0)), u.x), mix(sv_h(i + vec2(0.0, 1.0)), sv_h(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 v = normalize(vDir);
  vec3 c = sv_grad(v, uEyeY + v.y * 60.0, uMid);
  float snell = smoothstep(0.6, 0.78, v.y);
  vec2 sp = v.xz / max(v.y, 0.2);
  float rip = sv_n(sp * 9.0 + vec2(uTime * 0.15, uTime * 0.07)) * 0.6 + sv_n(sp * 23.0 - uTime * 0.2) * 0.4;
  c = mix(c, uPale * (0.95 + 0.25 * rip), snell * 0.85 * (0.35 + 0.65 * uDay));
  c += uSun * smoothstep(0.62, 0.72, v.y) * (1.0 - smoothstep(0.72, 0.9, v.y)) * 0.25 * uDay;
  vec2 h = normalize(v.xz + 1e-4);
  float az = atan(h.y, h.x);
  float r1 = smoothstep(0.62, 0.95, sv_n(vec2(az * 7.0 + uTime * 0.02, uTime * 0.05)));
  float r2 = smoothstep(0.66, 0.97, sv_n(vec2(az * 15.0 - uTime * 0.03, 4.0 + uTime * 0.07)));
  float rays = (r1 * 0.65 + r2 * 0.45) * smoothstep(-0.55, 0.15, v.y) * (1.0 - smoothstep(0.45, 0.7, v.y));
  c += mix(uPale, uSun, 0.35) * rays * 0.16 * uDay;
  gl_FragColor = vec4(c, 1.0);
}
`

/** The sortie water: a painted gradient dome around the eye and a haze that sinks the hull wall into it. */
export class SeaVolume {
  readonly dome: THREE.Mesh
  private readonly fog = new THREE.Fog(MID.getHex(), START, 40)
  private readonly mat: THREE.ShaderMaterial
  private readonly mid = new THREE.Color()
  private len = 40
  private sweep = 0

  constructor(private readonly ctx: GameContext) {
    installChunks()
    this.mat = new THREE.ShaderMaterial({
      vertexShader: DOME_VS,
      fragmentShader: DOME_FS,
      side: THREE.BackSide,
      depthWrite: true,
      uniforms: {
        uMid: { value: new THREE.Color() },
        uPale: { value: PALE.clone() },
        uSun: { value: new THREE.Color(0xfff1c9) },
        uDay: { value: 1 },
        uTime: { value: 0 },
        uEyeY: { value: 60 },
      },
    })
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 48, 24), this.mat)
    this.dome.name = 'world-eau-sortie'
    this.dome.frustumCulled = false
    this.dome.renderOrder = -100
    this.dome.visible = false
  }

  update(dt: number): void {
    const ctx = this.ctx
    const s = ctx.state
    const env = ctx.services.drift?.cameraEnv()
    const outside = s.mode === 'sortie' && (env ? env.indoor < 0.5 : true)
    const scene = ctx.scene
    this.dome.visible = outside
    if (!outside) {
      if (scene.fog === this.fog) scene.fog = null
      return
    }
    if (scene.fog !== this.fog) {
      scene.fog = this.fog
      this.sweep = 0
    }
    this.sweep -= dt
    if (this.sweep <= 0) {
      this.sweep = 2
      scene.traverse(unfogAdditive)
    }
    const h = s.time.hours
    const day = smooth(5, 7.5, h) * (1 - smooth(18.5, 21, h))
    this.mid.copy(NIGHT).lerp(MID, day)
    const target = lengthFor(s.env.visibility)
    this.len += (target - this.len) * Math.min(1, dt * 0.5)
    const t = ctx.clock.elapsed
    this.fog.color.copy(this.mid)
    this.fog.near = START
    this.fog.far = Math.round(this.len) + ((t % PERIOD) / PERIOD) * 0.999
    const u = this.mat.uniforms
    ;(u.uMid!.value as THREE.Color).copy(this.mid)
    u.uDay!.value = day
    u.uTime!.value = t
    u.uEyeY!.value = ctx.camera.position.y
    this.dome.position.copy(ctx.camera.position)
  }

  dispose(): void {
    if (this.ctx.scene.fog === this.fog) this.ctx.scene.fog = null
    this.dome.removeFromParent()
    this.dome.geometry.dispose()
    this.mat.dispose()
  }
}

function unfogAdditive(o: THREE.Object3D): void {
  const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
  if (!m) return
  for (const x of Array.isArray(m) ? m : [m]) {
    const f = x as unknown as { fog?: boolean }
    if (x.blending === THREE.AdditiveBlending && f.fog) {
      f.fog = false
      x.needsUpdate = true
    }
  }
}

function lengthFor(visibility: number): number {
  for (const [v, l] of LENGTHS) if (visibility <= v) return l
  return LENGTHS[LENGTHS.length - 1]![1]
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
