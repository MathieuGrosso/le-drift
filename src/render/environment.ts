import * as THREE from 'three'
import { GLSL_COMMON } from './glsl'
import { MAX_RIPPLES, type AllUniforms } from './uniforms'

export const FX_LAYER = 1

const BACKDROP_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const BACKDROP_FS = /* glsl */ `
varying vec3 vDir;
void main() {
  vec3 v = normalize(vDir);
  float y = clamp(cameraPosition.y + v.y * 2500.0, 0.0, rdCeilY);
  vec3 c = rd_hazeColor(v, y);
  vec2 h = normalize(v.xz + 1e-4);
  float lean = v.y * 0.35;
  float s1 = rd_noise(vec2(h.x * 7.0 + h.y * 3.0 + lean + rdTime * 0.012, rdTime * 0.04));
  float s2 = rd_noise(vec2(h.y * 13.0 - h.x * 5.0 - lean + rdTime * 0.02, 5.0 + rdTime * 0.06));
  float curtain = smoothstep(0.55, 0.95, s1) * 0.7 + smoothstep(0.6, 0.98, s2) * 0.5;
  curtain *= smoothstep(-0.35, 0.25, v.y) * (1.0 - smoothstep(0.55, 0.95, v.y));
  c += mix(rdPlafond, rdSunColor, 0.5) * rdSunI * rdDay * curtain * mix(0.07, 0.13, rdIndoor);
  float deep = smoothstep(0.0, -0.8, v.y);
  c = mix(c, rdAbysse * 0.8, deep * 0.35);
  c += rdPlankton * vec3(0.05, 0.07, 0.0);
  gl_FragColor = vec4(c, 1.0);
}
`

const CEILING_VS = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const CEILING_FS = /* glsl */ `
#include <fog_pars_fragment>
varying vec3 vW;

float rd_wave(vec2 p) {
  float t = rdTime;
  vec2 c = rdCurrent.xz * t * 0.6;
  float h = 0.35 * sin(dot(p, vec2(0.071, 0.029)) + t * 0.9)
          + 0.22 * sin(dot(p, vec2(-0.043, 0.088)) + t * 1.3)
          + 0.9 * rd_noise(p * 0.045 + c * 0.045 + vec2(t * 0.04, 0.0))
          + 0.35 * rd_noise(p * 0.13 - vec2(0.0, t * 0.11));
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = rdRipples[i];
    float age = t - r.z;
    if (age < 0.0 || age > 7.0 || r.w <= 0.0) continue;
    float d = length(p - r.xy);
    float x = d - age * 3.2;
    h += sin(x * 2.4) * exp(-x * x * 0.35) * r.w * exp(-age * 0.55) * 1.2;
  }
  if (rdRain > 0.001) {
    vec2 g = p / 2.2;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float k = rd_hash(id);
    float age = fract(t * 0.55 + k * 7.0);
    float on = step(k, rdRain);
    float rr = length(f - (rd_hash2(id + 3.1) - 0.5) * 0.5) - age * 0.45;
    h += on * sin(rr * 40.0) * exp(-rr * rr * 300.0) * (1.0 - age) * 0.5;
  }
  return h;
}

void main() {
  vec3 dv = vW - cameraPosition;
  float d = length(dv);
  vec3 V = dv / d;
  float e = 0.6;
  float h0 = rd_wave(vW.xz);
  float hx = rd_wave(vW.xz + vec2(e, 0.0));
  float hz = rd_wave(vW.xz + vec2(0.0, e));
  float detail = 1.0 / (1.0 + d * 0.004);
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.55 * detail, 1.0, -(hz - h0) / e * 0.55 * detail));

  float cosI = dot(V, n);
  float win = smoothstep(0.625, 0.705, cosI);
  vec3 airDir = refract(V, -n, 1.333);
  vec3 sun = rdSunColor * rdSunI;
  vec3 sky = mix(rdPlafond * 0.85, vec3(0.78, 0.9, 0.95), clamp(airDir.y, 0.0, 1.0));
  sky = mix(sky * 0.2, sky, rdDay) + sun * 0.12;
  float sd = max(dot(airDir, rdSunAir), 0.0);
  sky += sun * (pow(sd, 380.0) * 10.0 + pow(sd, 18.0) * 0.7 + pow(sd, 3.0) * 0.15);

  float shimmer = 1.0 - smoothstep(0.0, 0.3, rd_cellEdge(vW.xz * 0.11 + h0 * 0.35, rdTime * 0.5));
  shimmer *= detail * detail;

  vec2 sunXZ = normalize(rdSunDir.xz + 1e-4);
  float toward = dot(normalize(dv.xz + 1e-4), sunXZ) * 0.5 + 0.5;
  float overhead = smoothstep(0.35, 0.85, V.y);
  vec3 tir = mix(rdMilieu, rdClair, 0.35 + 0.35 * overhead + 0.15 * toward);
  tir *= (0.82 + 0.18 * rdDay) * (0.92 + 0.35 * dot(n.xz, sunXZ));
  tir += rdPlafond * shimmer * 0.06 * (0.3 + 0.7 * rdDay);
  vec3 refl = reflect(V, -n);
  tir += sun * pow(max(dot(-refl, rdSunDir), 0.0), 24.0) * 0.4;
  tir += sun * pow(toward, 6.0) * 0.12 * rdDay;

  vec3 col = mix(tir, sky * (0.88 + 0.3 * shimmer + 0.12 * h0), win);
  col += rdPlafond * win * (1.0 - win) * 1.6;

  float blanc = smoothstep(-600.0, -950.0, vW.z);
  col = mix(col, rdPlafond * 1.25 + sun * 0.15, blanc * 0.45);

  float haze = 1.0 - exp(-pow(d / (rdHazeDist * 1.25), 1.35));
  col = mix(col, rd_hazeColor(V, rdCeilY), haze);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`

export interface Environment {
  backdrop: THREE.Mesh
  ceiling: THREE.Mesh
  follow(camera: THREE.Camera): void
  dispose(): void
}

export function createEnvironment(scene: THREE.Scene, shared: AllUniforms): Environment {
  const backdropMat = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: BACKDROP_VS,
    fragmentShader: GLSL_COMMON + BACKDROP_FS,
    side: THREE.BackSide,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
  })
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), backdropMat)
  backdrop.name = 'render-backdrop'
  backdrop.frustumCulled = false
  backdrop.renderOrder = 10_000
  backdrop.layers.set(FX_LAYER)
  backdrop.userData.noShadow = true

  const ceilingMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
    fog: true,
    vertexShader: CEILING_VS,
    fragmentShader: GLSL_COMMON + CEILING_FS,
    side: THREE.FrontSide,
  })
  const ceilGeo = new THREE.PlaneGeometry(7000, 7000, 1, 1)
  ceilGeo.rotateX(Math.PI / 2)
  const ceiling = new THREE.Mesh(ceilGeo, ceilingMat)
  ceiling.name = 'render-ceiling'
  ceiling.frustumCulled = false
  ceiling.layers.set(FX_LAYER)
  ceiling.userData.noShadow = true

  scene.add(backdrop, ceiling)

  return {
    backdrop,
    ceiling,
    follow(camera) {
      backdrop.position.copy(camera.position)
      ceiling.position.set(camera.position.x, (shared.rdCeilY!.value as number), camera.position.z)
    },
    dispose() {
      scene.remove(backdrop, ceiling)
      backdrop.geometry.dispose()
      backdropMat.dispose()
      ceilGeo.dispose()
      ceilingMat.dispose()
    },
  }
}
