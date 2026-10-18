import * as THREE from 'three'
import type { GameContext } from '../core/types'

export interface PlantUniforms {
  uPlTime: { value: number }
  uPlHero: { value: THREE.Vector4 }
  uPlFlow: { value: THREE.Vector3 }
  uPlLean: { value: THREE.Vector2 }
  uPlGrow: { value: THREE.Vector4 }
}

export function createPlantUniforms(): PlantUniforms {
  return {
    uPlTime: { value: 0 },
    uPlHero: { value: new THREE.Vector4(0, -1000, 0, 0) },
    uPlFlow: { value: new THREE.Vector3(0, 0, 0.4) },
    uPlLean: { value: new THREE.Vector2(0, 0) },
    uPlGrow: { value: new THREE.Vector4(1, 1, 1, 1) },
  }
}

const VERT_PARS = /* glsl */ `
attribute vec4 aSw;
attribute vec4 aSw2;
uniform float uPlTime;
uniform vec4 uPlHero;
uniform vec3 uPlFlow;
uniform vec2 uPlLean;
uniform vec4 uPlGrow;
`

const VERT_MAIN = /* glsl */ `
{
  vec3 plPiv = aSw.xyz;
  float plFlex = aSw.w;
  float plPh = aSw2.x;
  float plKind = aSw2.y;
  float plG = aSw2.z;
  if (plKind < 3.5) {
    if (plG > -0.5) {
      float g = plG < 0.5 ? uPlGrow.x : plG < 1.5 ? uPlGrow.y : plG < 2.5 ? uPlGrow.z : uPlGrow.w;
      vec3 gd = transformed - plPiv;
      float gw = mix(0.6, 1.0, g);
      transformed = plPiv + vec3(gd.x * gw, gd.y * g, gd.z * gw);
    }
    float plUp = transformed.y - plPiv.y;
    bool plDown = plKind < 0.5 || plKind > 2.5;
    float h = plDown ? max(-plUp, 0.0) : max(plUp, 0.0);
    float t = uPlTime;
    vec2 off = vec2(0.0);
    vec2 fl = uPlFlow.xz;
    float flLen = length(fl);
    vec2 perp = flLen > 1e-3 ? vec2(-fl.y, fl.x) / flLen : vec2(1.0, 0.0);
    if (plKind < 0.5) {
      off = vec2(sin(t * 0.9 + plPh), cos(t * 0.7 + plPh * 1.3)) * 0.035 * h
        + vec2(sin(t * 1.7 + plPh + h * 2.3), cos(t * 1.4 + plPh + h * 1.7)) * 0.02 * h;
    } else if (plKind < 1.5) {
      off = vec2(sin(t * 1.3 + plPh + h * 3.0), cos(t * 1.1 + plPh)) * 0.022 * h + uPlLean * h * 0.15;
    } else if (plKind < 2.5) {
      off = perp * sin(t * 1.1 + plPh - h * 1.4) * 0.09 * h
        + vec2(cos(t * 0.8 + plPh * 0.7 - h), sin(t * 0.6 + plPh)) * 0.035 * h
        + fl * 0.06 * h + uPlLean * h * h * 0.04;
    } else {
      off = fl * h * 0.5 + perp * sin(t * 1.3 + plPh - h * 1.9) * 0.12 * h
        + vec2(0.0, cos(t * 1.1 + plPh - h * 1.5)) * 0.06 * h;
      transformed.y += h * min(flLen, 1.2) * 0.3;
    }
    off *= plFlex;
    if (uPlHero.w > 0.0) {
      vec3 hd = transformed - uPlHero.xyz;
      float dl = length(hd.xz);
      float f = (1.0 - smoothstep(uPlHero.w * 0.25, uPlHero.w, dl)) * (1.0 - smoothstep(1.1, 2.0, abs(hd.y - 0.9)));
      off += (dl > 1e-3 ? hd.xz / dl : vec2(1.0, 0.0)) * f * min(h, 1.2) * 0.75 * min(plFlex * 1.5, 1.0);
    }
    transformed.xz += off;
    if (plKind > 0.5 && plKind < 2.5) transformed.y -= dot(off, off) / max(2.0 * h, 0.25);
  }
}
`

function inject(shader: THREE.WebGLProgramParametersWithUniforms, u: PlantUniforms): void {
  Object.assign(shader.uniforms, u)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`)
}

export interface PlantMaterialOptions {
  indoor: boolean
  emissive?: number
  side?: THREE.Side
  rim?: number
  shadow?: number
}

export function createPlantMaterial(ctx: GameContext, u: PlantUniforms, opts: PlantMaterialOptions): THREE.Material {
  const render = ctx.services.render
  const side = opts.side ?? THREE.DoubleSide
  if (render) {
    const mat = render.cel({
      color: 0xffffff,
      vertexColors: true,
      side,
      indoor: opts.indoor,
      caustics: !opts.indoor,
      rim: opts.rim ?? 0.5,
      ...(opts.emissive !== undefined ? { emissive: opts.emissive } : {}),
      ...(opts.shadow !== undefined ? { shadowColor: opts.shadow } : {}),
      onShader: (shader) => inject(shader, u),
    })
    mat.userData.flora = true
    return mat
  }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side })
  if (opts.emissive !== undefined) mat.color.setHex(0xffffff)
  mat.onBeforeCompile = (shader) => inject(shader, u)
  mat.customProgramCacheKey = () => 'flora-plant-basic'
  return mat
}

export function setPlantEmissive(mat: THREE.Material, hex: number, intensity: number): void {
  const cu = mat.userData.celUniforms as { rdCelEmissive?: { value: THREE.Color } } | undefined
  cu?.rdCelEmissive?.value.setHex(hex).multiplyScalar(intensity)
}
