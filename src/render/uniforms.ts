import * as THREE from 'three'
import { CEILING_Y } from '../core/layout'
import { HAZE_BY_VISIBILITY, HAZE_MAX } from '../core/tuning'
import type { RenderService } from '../core/types'
import { PALETTE } from './palette'

export const MAX_LAMPS = 8
export const MAX_RIPPLES = 16

export type PublicUniforms = RenderService['uniforms']

export interface InternalUniforms {
  rdAbysse: { value: THREE.Color }
  rdProfond: { value: THREE.Color }
  rdMilieu: { value: THREE.Color }
  rdClair: { value: THREE.Color }
  rdPlafond: { value: THREE.Color }
  rdSable: { value: THREE.Color }
  rdInterieur: { value: THREE.Color }
  rdSunI: { value: number }
  rdDay: { value: number }
  rdPlankton: { value: number }
  rdRain: { value: number }
  rdSunAir: { value: THREE.Vector3 }
  rdCeilY: { value: number }
  rdShadowMap: { value: THREE.Texture | null }
  rdShadowMatrix: { value: THREE.Matrix4 }
  rdShadowOn: { value: number }
  rdShadowTexel: { value: number }
  rdRipples: { value: THREE.Vector4[] }
  rdAirBrume: { value: THREE.Color }
  rdCreme: { value: THREE.Color }
  rdBoisOmbre: { value: THREE.Color }
  rdVitreMer: { value: THREE.Color }
}

export function createPublicUniforms(): PublicUniforms {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.6, 0.6, 0.2).normalize() },
    uSunColor: { value: new THREE.Color(PALETTE.soleilJour) },
    uCurrent: { value: new THREE.Vector3(0, 0, -0.3) },
    uHeroPos: { value: new THREE.Vector3() },
    uHazeDist: { value: HAZE_BY_VISIBILITY[30] ?? 170 },
    uHazeMax: { value: HAZE_MAX },
    uIndoor: { value: 0 },
    uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uLampColors: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Color(PALETTE.soleilAube)) },
    uAirHaze: { value: 0 },
    uGlassDist: { value: 4 },
  }
}

export function createInternalUniforms(): InternalUniforms {
  return {
    rdAbysse: { value: new THREE.Color(PALETTE.abysse) },
    rdProfond: { value: new THREE.Color(PALETTE.profond) },
    rdMilieu: { value: new THREE.Color(PALETTE.milieu) },
    rdClair: { value: new THREE.Color(PALETTE.clair) },
    rdPlafond: { value: new THREE.Color(PALETTE.plafond) },
    rdSable: { value: new THREE.Color(PALETTE.sable) },
    rdInterieur: { value: new THREE.Color(PALETTE.interieurOmbre) },
    rdSunI: { value: 1 },
    rdDay: { value: 1 },
    rdPlankton: { value: 0 },
    rdRain: { value: 0 },
    rdSunAir: { value: new THREE.Vector3(0.6, 0.6, 0.2).normalize() },
    rdCeilY: { value: CEILING_Y },
    rdShadowMap: { value: null },
    rdShadowMatrix: { value: new THREE.Matrix4() },
    rdShadowOn: { value: 0 },
    rdShadowTexel: { value: 1 / 2048 },
    rdRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -1000, 0)) },
    rdAirBrume: { value: new THREE.Color(PALETTE.airBrume) },
    rdCreme: { value: new THREE.Color(PALETTE.creme) },
    rdBoisOmbre: { value: new THREE.Color(PALETTE.boisOmbre) },
    rdVitreMer: { value: new THREE.Color(PALETTE.vitreMer) },
  }
}

export type AllUniforms = Record<string, THREE.IUniform>

// Patched shaders see the public uniforms under rd* names: a caller's own `uniform float uTime`
// would otherwise be declared twice and fail to compile.
export function shaderUniforms(pub: PublicUniforms, int: InternalUniforms): AllUniforms {
  return {
    rdTime: pub.uTime,
    rdSunDir: pub.uSunDir,
    rdSunColor: pub.uSunColor,
    rdCurrent: pub.uCurrent,
    rdHeroPos: pub.uHeroPos,
    rdHazeDist: pub.uHazeDist,
    rdHazeMax: pub.uHazeMax,
    rdIndoor: pub.uIndoor,
    rdLamps: pub.uLamps,
    rdLampColors: pub.uLampColors,
    rdAirHaze: pub.uAirHaze,
    rdGlassDist: pub.uGlassDist,
    ...int,
  }
}
