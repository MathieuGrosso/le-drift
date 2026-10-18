import * as THREE from 'three'
import type { RenderService } from '../core/types'
import { FLORA_COLORS } from './palette'

export const BENDER_COUNT = 8

export interface FloraUniforms {
  uFlTime: { value: number }
  uFlCurrent: { value: THREE.Vector3 }
  uFlGust: { value: THREE.Vector4 }
  uFlCam: { value: THREE.Vector3 }
  uFlHero: { value: THREE.Vector3 }
  uFlBenders: { value: THREE.Vector4[] }
  uFlNight: { value: number }
  uFlSunDir: { value: THREE.Vector3 }
  uFlSunColor: { value: THREE.Color }
  uFlHazeDist: { value: number }
  uFlHazeMax: { value: number }
  uFlSky: { value: THREE.Color }
  uFlDeep: { value: THREE.Color }
  uFlAbysse: { value: THREE.Color }
  uFlMilieu: { value: THREE.Color }
  uFlClair: { value: THREE.Color }
}

export function createFloraUniforms(render: RenderService | undefined): FloraUniforms {
  return {
    uFlTime: { value: 0 },
    uFlCurrent: { value: new THREE.Vector3(0, 0, -0.4) },
    uFlGust: { value: new THREE.Vector4(0, -1, 0.7, 0.7) },
    uFlCam: { value: new THREE.Vector3() },
    uFlHero: { value: new THREE.Vector3(0, -1000, 0) },
    uFlBenders: { value: Array.from({ length: BENDER_COUNT }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uFlNight: { value: 0 },
    uFlSunDir: render?.uniforms.uSunDir ?? { value: new THREE.Vector3(0.45, 0.8, -0.4).normalize() },
    uFlSunColor: render?.uniforms.uSunColor ?? { value: new THREE.Color(FLORA_COLORS.soleilJour) },
    uFlHazeDist: render?.uniforms.uHazeDist ?? { value: 400 },
    uFlHazeMax: render?.uniforms.uHazeMax ?? { value: 0.93 },
    uFlSky: { value: new THREE.Color(FLORA_COLORS.plafond) },
    uFlDeep: { value: new THREE.Color(FLORA_COLORS.profond) },
    uFlAbysse: { value: new THREE.Color(FLORA_COLORS.abysse) },
    uFlMilieu: { value: new THREE.Color(FLORA_COLORS.milieu) },
    uFlClair: { value: new THREE.Color(FLORA_COLORS.clair) },
  }
}

export type FloraKind = 'grass' | 'tuft' | 'kelp' | 'coral' | 'anemone'

export interface FloraMaterialOptions {
  kind: FloraKind
  base: number
  tip: number
  shadow?: number
  side?: THREE.Side
}

export interface FloraMaterial {
  material: THREE.MeshBasicMaterial
  fade: { value: THREE.Vector4 }
}

const VERT_PARS = /* glsl */ `
attribute vec4 aFl;
attribute vec4 aFlI0;
attribute vec4 aFlI1;
attribute vec3 aFlCol;
uniform float uFlTime;
uniform vec3 uFlCurrent;
uniform vec4 uFlGust;
uniform vec3 uFlCam;
uniform vec3 uFlHero;
uniform vec4 uFlBenders[${BENDER_COUNT}];
uniform vec4 uFlFade;
varying vec3 vFlWorld;
varying vec3 vFlN;
varying vec3 vFlCol;
varying vec4 vFl;
`

const VERT_MAIN = /* glsl */ `
float flT = aFl.x;
vec3 flBase = aFlI0.xyz;
float flYaw = aFlI0.w;
float flD = distance(flBase.xz, uFlCam.xz);
float flFade = smoothstep(uFlFade.x, uFlFade.y, flD) * (1.0 - smoothstep(uFlFade.z, uFlFade.w, flD));
#if defined(FL_GRASS) && !defined(FL_TUFT)
vec3 flP = vec3(position.x * aFlI1.x, position.y * aFlI1.y, position.z * aFlI1.y) * flFade;
#else
vec3 flP = vec3(position.x * aFlI1.x, position.y * aFlI1.y, position.z * aFlI1.x) * flFade;
#endif
float flCy = cos(flYaw);
float flSy = sin(flYaw);
flP = vec3(flCy * flP.x + flSy * flP.z, flP.y, -flSy * flP.x + flCy * flP.z);
vec3 flN = vec3(flCy * normal.x + flSy * normal.z, normal.y, -flSy * normal.x + flCy * normal.z);
float flCurLen = length(uFlCurrent.xz);
vec2 flCurDir = flCurLen > 0.001 ? uFlCurrent.xz / flCurLen : vec2(0.0, -1.0);
vec2 flGDir = uFlGust.xy;
vec2 flPerp = vec2(-flGDir.y, flGDir.x);
float flPh = aFlI1.z;
float flWave = dot(flBase.xz, flGDir) * 0.035 - uFlTime * uFlGust.w;
float flGust = smoothstep(0.05, 1.0, sin(flWave) * 0.65 + sin(flWave * 0.43 + flBase.x * 0.011 - flBase.z * 0.007) * 0.35) * uFlGust.z;
vec2 flOff = vec2(0.0);
#ifdef FL_GRASS
  float flHt = aFlI1.y;
  float flB = flT * flT;
  flOff = (flCurDir * (0.16 + 0.22 * min(flCurLen, 2.0)) + flGDir * flGust * 0.8
    + flPerp * sin(uFlTime * 1.9 + flPh) * 0.07) * flB * flHt;
  #ifndef FL_TUFT
  for (int i = 0; i < ${BENDER_COUNT}; i++) {
    vec4 flBd = uFlBenders[i];
    if (flBd.w <= 0.0) continue;
    vec2 flDd = flBase.xz - flBd.xz;
    float flDl = length(flDd);
    float flF = (1.0 - smoothstep(flBd.w * 0.35, flBd.w, flDl)) * (1.0 - smoothstep(0.9, 2.4, flBd.y - flBase.y));
    flOff += (flDl > 0.001 ? flDd / flDl : flGDir) * flF * flT * flHt * 0.95;
    flP.y *= 1.0 - 0.65 * flF;
  }
  #endif
  flP.y = max(flP.y - dot(flOff, flOff) / max(2.0 * flHt, 0.01), 0.0);
#endif
#ifdef FL_KELP
  float flH = aFlI1.y;
  float flStiff = mix(0.12, 1.0, smoothstep(2.5, 9.0, distance(flBase.xz, uFlHero.xz)));
  float flU = pow(flT, 1.5);
  flOff = flCurDir * (0.05 + 0.05 * min(flCurLen, 2.0)) * flU * flH
    + flGDir * flGust * 0.055 * flU * flH
    + flPerp * sin(uFlTime * 0.7 + flPh - flT * 4.0) * 0.022 * flT * flH;
  flOff *= flStiff;
  flOff += flPerp * aFl.z * sin(uFlTime * 2.1 + flPh + flT * 23.0) * 0.35;
  flP.y += aFl.z * sin(uFlTime * 1.7 + flPh + flT * 17.0) * 0.18;
  flP.y -= dot(flOff, flOff) / max(2.0 * flH, 0.01);
#endif
#if defined(FL_CORAL) || defined(FL_ANEMONE)
  flOff = (flCurDir * 0.12 + flPerp * sin(uFlTime * 1.6 + flPh + flT * 3.0) * 0.12 + flGDir * flGust * 0.1)
    * flT * aFlI1.x * flFade;
#endif
transformed = flBase + flP + vec3(flOff.x, 0.0, flOff.y);
vFlWorld = transformed;
vFlN = flN;
vFlCol = aFlCol;
vFl = vec4(flT, aFl.y, flGust, aFl.w);
`

const FRAG_PARS = /* glsl */ `
uniform vec3 uFlSunDir;
uniform vec3 uFlSunColor;
uniform vec3 uFlBase;
uniform vec3 uFlTip;
uniform vec3 uFlShadow;
uniform vec3 uFlSky;
uniform vec3 uFlDeep;
uniform float uFlNight;
#ifdef FL_OWN_HAZE
uniform float uFlHazeDist;
uniform float uFlHazeMax;
uniform vec3 uFlAbysse;
uniform vec3 uFlMilieu;
uniform vec3 uFlClair;
#endif
varying vec3 vFlWorld;
varying vec3 vFlN;
varying vec3 vFlCol;
varying vec4 vFl;
`

const FRAG_MAIN = /* glsl */ `
{
  vec3 flN = normalize(vFlN);
  if (!gl_FrontFacing) flN.xz = -flN.xz;
  vec3 flSun = normalize(uFlSunDir);
  vec3 flV = normalize(cameraPosition - vFlWorld);
#ifdef FL_GRASS
  flN = normalize(mix(flN, vec3(0.0, 1.0, 0.0), 0.75));
  vec3 flAlb = mix(uFlBase, uFlTip, smoothstep(0.05, 1.0, vFl.x)) * vFlCol;
  flAlb *= mix(0.74, 1.0, vFl.x);
  flAlb += uFlTip * vFl.z * 0.2 * vFl.x;
#else
  vec3 flAlb = vFlCol * mix(0.62, 1.0, vFl.y);
  flAlb = mix(flAlb, uFlTip, vFl.w * 0.85);
#endif
  float flNdl = dot(flN, flSun);
  float flB1 = smoothstep(-0.04, 0.04, flNdl);
  float flB2 = smoothstep(0.42, 0.5, flNdl);
  vec3 flCol = mix(flAlb * mix(vec3(0.62), uFlShadow * 1.5, 0.55), flAlb * mix(vec3(0.86), uFlSunColor, 0.35), flB1);
  flCol = mix(flCol, flAlb * mix(vec3(1.0), uFlSunColor, 0.6) * 1.06, flB2);
  flCol += flAlb * mix(uFlDeep, uFlSky, flN.y * 0.5 + 0.5) * 0.28;
  float flRim = pow(1.0 - clamp(abs(dot(flN, flV)), 0.0, 1.0), 3.0);
  flCol += uFlSunColor * flRim * 0.3 * (0.35 + 0.65 * flB1);
#ifdef FL_KELP
  float flBack = pow(clamp(dot(-flV, flSun), 0.0, 1.0), 4.0);
  flCol += flAlb * uFlSunColor * flBack * 0.6 * (0.4 + 0.6 * vFl.x);
#endif
#ifdef FL_ANEMONE
  flCol += uFlTip * uFlNight * (0.15 + 1.1 * vFl.w);
#endif
#ifdef FL_OWN_HAZE
  float flDist = length(vFlWorld - cameraPosition);
  float flHz = min(1.0 - exp(-pow(flDist / uFlHazeDist, 1.35)), uFlHazeMax);
  vec3 flVd = -flV;
  float flUp = clamp(flVd.y * 0.5 + 0.5, 0.0, 1.0);
  float flDepth = clamp(vFlWorld.y / 120.0, 0.0, 1.0);
  vec3 flHc = mix(uFlAbysse, uFlMilieu, smoothstep(0.0, 0.55, flUp));
  flHc = mix(flHc, uFlClair, smoothstep(0.45, 1.0, 0.6 * flUp + 0.4 * flDepth));
  flHc += uFlSunColor * pow(max(dot(flVd, flSun), 0.0), 6.0) * 0.35;
  flCol *= mix(vec3(1.0), vec3(0.88, 0.97, 1.0), flHz);
  flCol = mix(flCol, flHc, flHz);
#endif
  outgoingLight = flCol;
}
`

const MARK = '/*flora*/'

const DEFINES: Record<FloraKind, Record<string, string>> = {
  grass: { FL_GRASS: '' },
  tuft: { FL_GRASS: '', FL_TUFT: '' },
  kelp: { FL_KELP: '' },
  coral: { FL_CORAL: '' },
  anemone: { FL_ANEMONE: '' },
}

export function createFloraMaterial(
  u: FloraUniforms,
  opts: FloraMaterialOptions,
  render: RenderService | undefined,
): FloraMaterial {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: opts.side ?? THREE.FrontSide })
  const fade = { value: new THREE.Vector4(-2, -1, 1e6, 2e6) }
  const own: Record<string, { value: unknown }> = {
    ...u,
    uFlFade: fade,
    uFlBase: { value: new THREE.Color(opts.base) },
    uFlTip: { value: new THREE.Color(opts.tip) },
    uFlShadow: { value: new THREE.Color(opts.shadow ?? FLORA_COLORS.rocheOmbre) },
  }
  material.defines = { ...DEFINES[opts.kind], ...(render ? {} : { FL_OWN_HAZE: '' }) }

  const inject = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    if (shader.vertexShader.includes(MARK)) return
    for (const [k, v] of Object.entries(own)) shader.uniforms[k] = v
    if (!shader.vertexShader.includes('#include <begin_vertex>') || !shader.fragmentShader.includes('#include <opaque_fragment>')) {
      console.warn('[flora] shader chunks missing, sway/lighting not injected')
      return
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${MARK}\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <opaque_fragment>', `${FRAG_MAIN}\n#include <opaque_fragment>`)
  }
  material.onBeforeCompile = inject
  material.customProgramCacheKey = () => `flora-${opts.kind}`

  if (render) {
    render.patchWater(material)
    const theirs = material.onBeforeCompile
    if (theirs !== inject) {
      // patchWater may replace onBeforeCompile; ours must run first so its chunks are still intact.
      material.onBeforeCompile = (shader, renderer) => {
        inject(shader)
        theirs.call(material, shader, renderer)
      }
    }
    const theirKey = material.customProgramCacheKey
    material.customProgramCacheKey = () => `flora-${opts.kind}|${theirKey.call(material)}`
  }
  return { material, fade }
}
