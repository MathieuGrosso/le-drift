import * as THREE from 'three'
import type { GameContext } from '../core/types'
import { PALETTE } from './shared'
import type { Stage } from './stage'

const COUNT = 900
const HALF = new THREE.Vector3(16, 10, 16)

const VERT = `
attribute float aSeed;
uniform vec3 uCentre;
uniform vec3 uHalf;
uniform vec3 uOffset;
uniform float uTime;
uniform float uSize;
uniform float uPx;
uniform vec3 uPlaneP;
uniform vec3 uPlaneN;
varying float vAlpha;
varying float vTwinkle;
void main() {
  vec3 p = position + uOffset;
  p = mod(p - uCentre + uHalf, 2.0 * uHalf) - uHalf;
  vec3 edge = 1.0 - smoothstep(uHalf * 0.7, uHalf, abs(p));
  p += uCentre;
  float front = smoothstep(0.25, 1.2, dot(p - uPlaneP, uPlaneN));
  p.x += sin(uTime * 0.35 + aSeed * 40.0) * 0.25;
  p.z += cos(uTime * 0.3 + aSeed * 31.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vAlpha = front * edge.x * edge.y * edge.z * (1.0 - smoothstep(18.0, 34.0, d)) * smoothstep(0.4, 1.6, d);
  vTwinkle = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 2.5) + aSeed * 60.0);
  gl_PointSize = uSize * (0.5 + aSeed) * uPx / max(d, 0.5);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uGlow;
varying float vAlpha;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c) * 4.0;
  float a = (1.0 - smoothstep(0.2, 1.0, r)) * vAlpha * uOpacity * mix(1.0, vTwinkle, uGlow);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (1.0 + uGlow * 0.6), a);
}`

/**
 * Marine snow drifting past the glass, which is what makes the water read as water a metre out.
 * On a plankton night it glows green-gold and twinkles.
 */
export class Motes {
  readonly group = new THREE.Group()
  private readonly points: THREE.Points
  private readonly mat: THREE.ShaderMaterial
  private readonly offset = new THREE.Vector3()
  private readonly centre = new THREE.Vector3()
  private readonly snow = new THREE.Color(PALETTE.plafond)
  private readonly plankton = new THREE.Color(0xd9f47a)
  private glow = 0

  constructor(private readonly ctx: GameContext, private readonly stage: Stage) {
    const rng = ctx.rng('fauna:motes')
    const pos = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (rng() * 2 - 1) * HALF.x
      pos[i * 3 + 1] = (rng() * 2 - 1) * HALF.y
      pos[i * 3 + 2] = (rng() * 2 - 1) * HALF.z
      seed[i] = rng()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uCentre: { value: this.centre },
        uHalf: { value: HALF.clone() },
        uOffset: { value: this.offset },
        uTime: { value: 0 },
        uSize: { value: 11 },
        uPx: { value: 1 },
        uColor: { value: this.snow.clone() },
        uOpacity: { value: 0.5 },
        uGlow: { value: 0 },
        uPlaneP: { value: new THREE.Vector3() },
        uPlaneN: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    })
    this.points = new THREE.Points(geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    this.points.name = 'fauna-neige-marine'
    this.group.add(this.points)
  }

  update(dt: number): void {
    const ctx = this.ctx
    const st = this.stage
    const u = this.mat.uniforms
    const env = ctx.state.env
    const night = st.night
    const bloomNight = night && (env.bloom > 0.4 || ctx.state.time.day % 5 === 0)
    this.glow += ((bloomNight ? 1 : 0) - this.glow) * Math.min(1, dt * 0.5)
    const cur = env.current
    const v = ctx.state.drift.velocity
    this.offset.x -= (v.x - cur.x * 0.6) * dt
    this.offset.y -= 0.08 * dt
    this.offset.z -= (v.z - cur.z * 0.6) * dt
    const planeP = u.uPlaneP!.value as THREE.Vector3
    const planeN = u.uPlaneN!.value as THREE.Vector3
    if (st.kind === 'sortie') {
      this.centre.copy(ctx.camera.position)
      planeN.set(0, 1, 0)
      planeP.set(0, -1e5, 0)
    } else {
      st.point(HALF.z * 0.75, 0, 0, this.centre)
      planeN.copy(st.normal)
      planeP.copy(st.pos)
    }
    u.uTime!.value = ctx.clock.elapsed
    u.uPx!.value = ctx.renderer.domElement.height / 1080
    u.uGlow!.value = this.glow
    ;(u.uColor!.value as THREE.Color).copy(this.snow).lerp(this.plankton, this.glow)
    u.uOpacity!.value = (night ? 0.18 : 0.42) + this.glow * 0.65
    u.uSize!.value = 11 + this.glow * 9
  }

  dispose(): void {
    this.group.removeFromParent()
    this.points.geometry.dispose()
    this.mat.dispose()
  }
}
