import * as THREE from 'three'
import { DRIFT_BOUNDS } from '../core/layout'
import type { GameContext, GameState, QualityLevel } from '../core/types'

const COUNT: Record<QualityLevel, number> = { high: 900, medium: 600, low: 320 }
const MAX = COUNT.high
const VENTS = [-44, -30, -16, -4, 8, 20, 34, 46]
const LIFE = 70

const VERTEX_DECL = /* glsl */ `
attribute vec4 aWake;
attribute vec2 aVent;
uniform float rdTime;
uniform float uWdWakeSpeed;
varying vec2 vWdUv;
varying float vWdAlpha;
varying float vWdKind;
`

// aWake: x = phase, y = kind (0 bubble, 1 remous), z = lateral seed, w = size seed. aVent: origin x, y.
const VERTEX_BODY = /* glsl */ `
float wdAge = fract(rdTime / ${LIFE.toFixed(1)} + aWake.x);
float wdBubble = 1.0 - aWake.y;
float wdT = wdAge * ${LIFE.toFixed(1)};
float wdBack = wdT * uWdWakeSpeed * mix(1.0, 0.55, wdBubble) + 2.0;
float wdRise = mix(wdT * 0.18, wdT * (0.9 + aWake.w * 0.8), wdBubble);
float wdSpread = (aWake.z - 0.5) * (2.0 + wdT * mix(0.35, 0.12, wdBubble));
vec3 wdCentre = vec3(aVent.x + wdSpread + sin(rdTime * 2.1 + aWake.x * 53.0) * 0.35 * wdBubble, aVent.y + wdRise, ${DRIFT_BOUNDS.z1.toFixed(1)} + wdBack);
float wdSize = mix(0.16 + aWake.w * 0.3, 3.0 + wdT * 0.25 + aWake.w * 3.0, aWake.y);
vec3 wdR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * mat3(modelMatrix);
vec3 wdU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * mat3(modelMatrix);
vec3 transformed = wdCentre + (wdR * position.x + wdU * position.y) * wdSize;
vWdUv = position.xy;
float wdIn = smoothstep(0.0, 0.04, wdAge);
float wdOut = 1.0 - smoothstep(mix(0.45, 0.25, wdBubble), 1.0, wdAge);
vWdAlpha = wdIn * wdOut * mix(0.85, 0.2 + 0.1 * aWake.w, aWake.y);
vWdKind = aWake.y;
`

const FRAGMENT_DECL = /* glsl */ `
varying vec2 vWdUv;
varying float vWdAlpha;
varying float vWdKind;
`

const FRAGMENT_BODY = /* glsl */ `
{
  float r = length(vWdUv) * 2.0;
  if (r > 1.0) discard;
  float a;
  vec3 c;
  if (vWdKind < 0.5) {
    float rim = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
    float glint = 1.0 - smoothstep(0.0, 0.28, length(vWdUv * 2.0 - vec2(-0.32, 0.36)));
    a = max(rim * 0.9, glint) + 0.12;
    c = mix(rdClair, vec3(1.0), 0.65 + 0.35 * glint) + rdSunColor * rdSunI * 0.25;
  } else {
    float n = rd_noise(vWdUv * 3.0 + vec2(rdTime * 0.05, -rdTime * 0.03) + vWdAlpha * 13.0);
    a = (1.0 - smoothstep(0.15, 1.0, r)) * (0.55 + 0.45 * n);
    c = mix(rdClair, rdPlafond, 0.5) * (0.75 + 0.35 * rdDay);
  }
  diffuseColor = vec4(c, a * vWdAlpha);
  outgoingLight = c;
}
#include <opaque_fragment>
`

// The Drift's wake: bubble threads from the aft ballast vents and slow churned water trailing behind,
// what the refectory watches through the Grande Vitre. One instanced draw, animated on the GPU.
export class Wake {
  readonly mesh: THREE.Mesh
  private readonly geo: THREE.InstancedBufferGeometry
  private readonly speed = { value: 0.9 }

  constructor(ctx: GameContext) {
    const rng = ctx.rng('world:wake')
    const wake = new Float32Array(MAX * 4)
    const vent = new Float32Array(MAX * 2)
    for (let i = 0; i < MAX; i++) {
      const remous = i % 5 === 0
      const v = VENTS[Math.floor(rng() * VENTS.length)]!
      wake.set([rng(), remous ? 1 : 0, rng(), rng()], i * 4)
      const y = remous ? DRIFT_BOUNDS.y0 + 4 + rng() * 14 : DRIFT_BOUNDS.y0 + 1.5 + rng() * 3
      vent.set([v + (rng() - 0.5) * 3, y], i * 2)
    }
    const quad = new THREE.PlaneGeometry(1, 1)
    this.geo = new THREE.InstancedBufferGeometry()
    this.geo.index = quad.index
    this.geo.setAttribute('position', quad.getAttribute('position'))
    this.geo.setAttribute('aWake', new THREE.InstancedBufferAttribute(wake, 4))
    this.geo.setAttribute('aVent', new THREE.InstancedBufferAttribute(vent, 2))

    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    mat.customProgramCacheKey = () => 'world-wake'
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWdWakeSpeed = this.speed
      shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_BODY)
      shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader.replace('#include <opaque_fragment>', FRAGMENT_BODY)
    }
    ctx.services.render?.patchWater(mat)
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.name = 'world-sillage'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.setQuality(ctx.quality.level)
  }

  setQuality(level: QualityLevel): void {
    this.geo.instanceCount = COUNT[level]
  }

  update(state: GameState): void {
    const d = state.drift
    this.mesh.position.set(d.position.x, d.position.y, d.position.z)
    this.mesh.rotation.set(0, -d.heading, 0)
    const driftSpeed = Math.hypot(d.velocity.x, d.velocity.z)
    const target = 0.35 + Math.min(1.5, Math.max(0, driftSpeed)) * 1.1
    this.speed.value += (target - this.speed.value) * 0.02
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.geo.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
