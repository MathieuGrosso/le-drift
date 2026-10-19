import * as THREE from 'three'
import { HOMES } from '../../core/tuning'

export const HOLE_UNIFORMS = {
  uHoleInv: { value: new THREE.Matrix4() },
  uHoleC: { value: Array.from({ length: HOMES.holes }, () => new THREE.Vector4()) },
  uHoleA: { value: Array.from({ length: HOMES.holes }, () => new THREE.Vector4()) },
  uHoleCount: { value: 0 },
}

const DECL = /* glsl */ `
uniform mat4 uHoleInv;
uniform vec4 uHoleC[${HOMES.holes}];
uniform vec4 uHoleA[${HOMES.holes}];
uniform int uHoleCount;
`
// A doorway cut through the shared hull shell: u along the wall, d into the hall, from the room's front wall out.
const CUT = /* glsl */ `
vec3 rdHl = (uHoleInv * vec4(vRdW, 1.0)).xyz;
for (int i = 0; i < ${HOMES.holes}; i++) {
  if (i >= uHoleCount) break;
  vec3 q = rdHl - uHoleC[i].xyz;
  float u = dot(q.xz, uHoleA[i].xy);
  float d = dot(q.xz, uHoleA[i].zw);
  if (abs(u) < ${(HOMES.doorW / 2).toFixed(3)} && q.y > -0.05 && q.y < ${HOMES.doorH.toFixed(3)} && d > -0.05 && d < 1.4) discard;
}
`

export function holePatch(shader: THREE.WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, HOLE_UNIFORMS)
  shader.fragmentShader = DECL + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT}`)
}
