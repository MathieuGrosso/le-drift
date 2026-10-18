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
vec3 wd_bio(vec3 W) {
  float k = (1.0 - rdDay) * (0.3 + 0.7 * rdPlankton);
  if (k < 0.01) return vec3(0.0);
  vec2 g = W.xz / 2.6;
  vec2 i = floor(g);
  vec2 o = rd_hash2(i) - 0.5;
  float d = length(fract(g) - 0.5 - o * 0.6);
  float px = length(fwidth(g));
  float rad = 0.11 + px * 0.8;
  float pool = smoothstep(0.42, 0.8, rd_noise(W.xz / 30.0 + vec2(rdTime * 0.004, 0.0)));
  float on = step(1.0 - pool * 0.85, rd_hash(i + 7.31));
  float tw = 0.45 + 0.55 * sin(rdTime * (0.6 + rd_hash(i + 3.1) * 1.4) + rd_hash(i + 1.7) * 6.28);
  float spot = (1.0 - smoothstep(rad * 0.35, rad, d)) * on * max(tw, 0.0) * min(1.0, pow(0.14 / rad, 1.5));
  vec3 c = mix(vec3(0.2, 0.95, 0.78), vec3(0.42, 0.62, 1.0), rd_hash(i + 9.9));
  float dist = max(length(W - cameraPosition) - rdGlassDist * rdIndoor, 0.0);
  float hz = min(rd_hazeAmount(dist), rdHazeMax);
  return c * (spot * 3.0 + pool * pool * 0.12 * (0.4 + rdPlankton)) * k * (1.0 - 0.7 * hz);
}
`

// The Drift's street-striped shadow on the floor, its lit windows pooling warm light at night, and the
// bioluminescent specks that wake on the floor after dark (brighter on plankton nights).
export function driftShadeShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uWdDrift = driftShadeUniform
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', `${SHADE_GLSL}\nvoid main() {`)
    .replace('outgoingLight = rd_cel(outgoingLight,', 'outgoingLight = rd_cel(outgoingLight * wd_driftShade(vRdW),')
    .replace('#include <opaque_fragment>', 'outgoingLight += wd_bio(vRdW);\n#include <opaque_fragment>')
}

export function updateDriftShade(state: GameState): void {
  const d = state.drift
  driftShadeUniform.value.set(d.position.x, d.position.z, d.heading, d.position.y + DRIFT_BOUNDS.y0)
}
