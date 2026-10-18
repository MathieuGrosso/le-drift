import * as THREE from 'three'
import { DRIFT_BOUNDS } from '../core/layout'
import type { GameState } from '../core/types'

export const driftShadeUniform = { value: new THREE.Vector4(0, 0, 0, -1000) }

const HALF_X = (DRIFT_BOUNDS.x1 - DRIFT_BOUNDS.x0) / 2 - 12
const HALF_Z = (DRIFT_BOUNDS.z1 - DRIFT_BOUNDS.z0) / 2 - 12

const SHADE_GLSL = /* glsl */ `
uniform vec4 uWdDrift;
vec3 wd_driftShade(vec3 W) {
  float h = uWdDrift.w - W.y;
  if (h <= 0.0) return vec3(1.0);
  vec3 L = rdSunDir;
  vec2 p = W.xz + L.xz / max(L.y, 0.35) * h - uWdDrift.xy;
  float c = cos(uWdDrift.z);
  float s = sin(uWdDrift.z);
  vec2 l = vec2(p.x * c + p.y * s, -p.x * s + p.y * c);
  vec2 q = abs(l) - vec2(${HALF_X.toFixed(1)}, ${HALF_Z.toFixed(1)});
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 12.0;
  float soft = 5.0 + h * 0.3;
  float body = 1.0 - smoothstep(-soft, soft, sd);
  if (body <= 0.001) return vec3(1.0);
  float rows = 0.5 + 0.5 * cos(l.x * 0.5236);
  float streets = smoothstep(0.55, 1.0, rows);
  float day = mix(0.3, 1.0, rdDay);
  vec3 shade = vec3(1.0 - body * (0.46 - 0.16 * streets) * day);
  float wn = rd_noise(l * 0.35 + vec2(0.0, rdTime * 0.02));
  float windows = body * (1.0 - rdDay) * streets * smoothstep(0.55, 0.85, wn);
  return shade + vec3(1.0, 0.72, 0.38) * windows * 0.9;
}
`

// The Drift casts a soft street-striped shadow on the floor; at night its lit windows pool warm light there.
export function driftShadeShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uWdDrift = driftShadeUniform
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', `${SHADE_GLSL}\nvoid main() {`)
    .replace('outgoingLight = rd_cel(outgoingLight,', 'outgoingLight = rd_cel(outgoingLight * wd_driftShade(vRdW),')
}

export function updateDriftShade(state: GameState): void {
  const d = state.drift
  driftShadeUniform.value.set(d.position.x, d.position.z, d.heading, d.position.y + DRIFT_BOUNDS.y0)
}
