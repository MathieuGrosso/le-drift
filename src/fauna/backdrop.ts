import * as THREE from 'three'
import type { GameContext } from '../core/types'
import { PALETTE } from './shared'
import type { Stage } from './stage'

const DIST = 40
const WIDTH = 170
const HEIGHT = 100
const SHAFTS = 4

const CARD_VS = /* glsl */ `
varying vec3 vW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
// The far wall of water seen through glass, painted: depth gradient, Snell's window at the top, slanted shafts.
const CARD_FS = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uTop;
uniform vec3 uPale;
uniform vec3 uSun;
uniform float uDay;
uniform float uTime;
uniform float uAlpha;
varying vec3 vW;
varying vec2 vUv;
float bd_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bd_n(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bd_h(i), bd_h(i + vec2(1.0, 0.0)), u.x), mix(bd_h(i + vec2(0.0, 1.0)), bd_h(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 v = normalize(vW - cameraPosition);
  float e = v.y;
  vec3 c = mix(uDeep * 0.7, uDeep, smoothstep(-0.45, -0.18, e));
  c = mix(c, uMid, smoothstep(-0.22, 0.0, e));
  c = mix(c, uTop, smoothstep(0.02, 0.16, e)) * 0.82;
  vec2 p = vec2(vUv.x * ${(WIDTH / 6).toFixed(1)}, vUv.y * ${(HEIGHT / 6).toFixed(1)});
  float rip = bd_n(p * 1.7 + vec2(uTime * 0.12, 0.0)) * 0.6 + bd_n(p * 4.3 - vec2(0.0, uTime * 0.2)) * 0.4;
  float snell = smoothstep(0.1, 0.22, e);
  c = mix(c, uPale * (0.92 + 0.22 * rip), snell * 0.8);
  c += uSun * smoothstep(0.13, 0.17, e) * (1.0 - smoothstep(0.17, 0.26, e)) * 0.18;
  float sx = vUv.x * 7.0 + vUv.y * 2.4;
  float s1 = smoothstep(0.58, 0.92, bd_n(vec2(sx + uTime * 0.025, uTime * 0.04)));
  float s2 = smoothstep(0.64, 0.95, bd_n(vec2(sx * 2.3 - uTime * 0.03, 7.0 + uTime * 0.06)));
  float rays = (s1 * 0.7 + s2 * 0.4) * smoothstep(-0.35, 0.05, e) * (1.0 - snell * 0.7);
  c += mix(uPale, uSun, 0.4) * rays * 0.22;
  c *= mix(0.22, 1.0, uDay);
  vec2 q = abs(vUv - 0.5) * 2.0;
  float edge = (1.0 - smoothstep(0.55, 1.0, q.x)) * (1.0 - smoothstep(0.6, 1.0, q.y));
  gl_FragColor = vec4(c, edge * uAlpha);
}
`

const SHAFT_VS = /* glsl */ `
attribute float aShaft;
varying vec2 vUv;
varying float vShaft;
void main() {
  vUv = uv;
  vShaft = aShaft;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const SHAFT_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
varying float vShaft;
void main() {
  float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float core = smoothstep(0.0, 0.8, across);
  float down = smoothstep(0.0, 0.55, vUv.y) * (0.35 + 0.65 * vUv.y);
  float flick = 0.7 + 0.3 * sin(uTime * (0.35 + vShaft * 0.11) + vShaft * 2.7);
  float a = core * down * flick * uStrength;
  gl_FragColor = vec4(uColor * a, a);
}
`

/** What the sea looks like beyond a pane by day: a painted far wall of water and a few light shafts in front of it. */
export class SeaBackdrop {
  readonly group = new THREE.Group()
  private readonly card: THREE.Mesh
  private readonly shafts: THREE.Mesh
  private readonly cardMat: THREE.ShaderMaterial
  private readonly shaftMat: THREE.ShaderMaterial
  private readonly m = new THREE.Matrix4()
  private readonly back = new THREE.Vector3()
  private readonly at = new THREE.Vector3()
  private readonly left = new THREE.Vector3()
  private alpha = 0

  constructor(private readonly ctx: GameContext, private readonly stage: Stage) {
    this.cardMat = new THREE.ShaderMaterial({
      vertexShader: CARD_VS,
      fragmentShader: CARD_FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDeep: { value: new THREE.Color(PALETTE.profond) },
        uMid: { value: new THREE.Color(PALETTE.milieu) },
        uTop: { value: new THREE.Color(PALETTE.clair) },
        uPale: { value: new THREE.Color(PALETTE.plafond) },
        uSun: { value: new THREE.Color(0xfff1c9) },
        uDay: { value: 1 },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
      },
    })
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), this.cardMat)
    this.card.name = 'fauna-mer-peinte'
    this.card.matrixAutoUpdate = false
    this.card.frustumCulled = false
    this.card.renderOrder = -5

    this.shaftMat = new THREE.ShaderMaterial({
      vertexShader: SHAFT_VS,
      fragmentShader: SHAFT_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0xe8fff6) }, uTime: { value: 0 }, uStrength: { value: 0 } },
    })
    this.shafts = new THREE.Mesh(shaftGeometry(), this.shaftMat)
    this.shafts.name = 'fauna-rais'
    this.shafts.matrixAutoUpdate = false
    this.shafts.frustumCulled = false
    this.group.add(this.card, this.shafts)
  }

  update(dt: number): void {
    const st = this.stage
    const h = this.ctx.state.time.hours
    const day = smooth(5.5, 8, h) * (1 - smooth(18, 20.5, h))
    const wanted = (st.kind === 'window' || st.kind === 'hull') && Math.abs(st.normal.y) < 0.5 ? 1 : 0
    this.alpha += (wanted - this.alpha) * Math.min(1, dt * 3)
    if (this.ctx.state.debug.cameraLocked) this.alpha = wanted
    this.group.visible = this.alpha > 0.01
    if (!this.group.visible) return
    this.back.copy(st.normal).negate()
    this.m.makeBasis(this.left.copy(st.tangent).negate(), st.up, this.back)
    st.point(DIST, 0, HEIGHT * 0.12, this.at)
    this.m.setPosition(this.at)
    this.card.matrix.copy(this.m)
    this.card.matrixWorldNeedsUpdate = true
    st.point(14, 0, 0, this.at)
    this.m.makeBasis(st.tangent, st.up, st.normal).setPosition(this.at)
    this.shafts.matrix.copy(this.m)
    this.shafts.matrixWorldNeedsUpdate = true
    const t = this.ctx.clock.elapsed
    const u = this.cardMat.uniforms
    u.uDay!.value = day
    u.uTime!.value = t
    u.uAlpha!.value = this.alpha * (0.35 + 0.57 * day)
    this.shaftMat.uniforms.uTime!.value = t
    this.shaftMat.uniforms.uStrength!.value = this.alpha * day * 0.16 * (0.6 + 0.4 * Math.min(1, this.ctx.state.env.visibility / 90))
  }

  dispose(): void {
    this.group.removeFromParent()
    this.card.geometry.dispose()
    this.shafts.geometry.dispose()
    this.cardMat.dispose()
    this.shaftMat.dispose()
  }
}

// Slanted quads in the frame of the pane (x along it, y up, z away from it), leaning from the ceiling.
function shaftGeometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const id: number[] = []
  const idx: number[] = []
  const spots = [[-9, 3, 2.6], [-2.5, 11, 3.8], [4, 5, 2.2], [10, 16, 4.6]] as const
  for (let i = 0; i < SHAFTS; i++) {
    const [x, z, w] = spots[i]!
    const top = 26
    const bottom = -14
    const lean = 7
    const b = pos.length / 3
    for (const [px, py, pz, u, v] of [
      [x - w / 2, bottom, z, 0, 0], [x + w / 2, bottom, z, 1, 0],
      [x - w * 0.7 + lean, top, z + 3, 0, 1], [x + w * 0.7 + lean, top, z + 3, 1, 1],
    ] as const) {
      pos.push(px, py, pz)
      uv.push(u, v)
      id.push(i)
    }
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aShaft', new THREE.Float32BufferAttribute(id, 1))
  g.setIndex(idx)
  return g
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
