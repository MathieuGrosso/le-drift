import * as THREE from 'three'
import { REGIONS } from '../core/layout'
import type { GameContext } from '../core/types'
import { fbm, valueNoise } from './noise'
import { blancWeight, smoothstep, VENT } from './terrain'

const c = (hex: number) => new THREE.Color(hex)
export const PAL = {
  sable: c(0xe9ddb8),
  sableOmbre: c(0xb8a77e),
  roche: c(0x7d8a96),
  rocheOmbre: c(0x45507a),
  herbe: c(0x8fbf6a),
  herbeOmbre: c(0x4f8a5a),
  laminaireOmbre: c(0x7a6a2a),
  blanc: c(0xf4f1e6),
  blancOmbre: c(0xdceff0),
  fumee: c(0x5a4b5e),
  coeur: c(0xff8a4c),
  corail: c(0xf08a7e),
}

const tmp = new THREE.Color()
const tmp2 = new THREE.Color()

function lerpInto(out: THREE.Color, col: THREE.Color, t: number): void {
  if (t <= 0) return
  out.lerp(col, t > 1 ? 1 : t)
}

export function surfaceColor(x: number, z: number, h: number, ny: number, out: THREE.Color): THREE.Color {
  const n1 = fbm(x / 60, z / 60, 2, 201)
  const n2 = valueNoise(x / 7, z / 7, 203)
  out.copy(PAL.sable).lerp(PAL.sableOmbre, 0.22 + 0.25 * n1)

  const lam = 1 - smoothstep(180, 330, Math.hypot(x - REGIONS.laminaires.x, z - REGIONS.laminaires.z))
  lerpInto(out, PAL.laminaireOmbre, lam * (0.35 + 0.15 * n1))

  const coq = 1 - smoothstep(140, 280, Math.hypot(x - REGIONS.coques.x, z - REGIONS.coques.z))
  lerpInto(out, tmp.copy(PAL.sableOmbre).lerp(PAL.rocheOmbre, 0.3), coq * 0.45)

  const mossZone = smoothstep(-0.15, 0.35, fbm(x / 140, z / 140, 3, 207)) * (1 - blancWeight(z))
  const flat = smoothstep(0.86, 0.97, ny)
  const midDepth = 1 - smoothstep(55, 85, h)
  lerpInto(out, tmp.copy(PAL.herbeOmbre).lerp(PAL.herbe, 0.35 + 0.35 * n2), mossZone * flat * midDepth * 0.55)

  const rock = smoothstep(0.86, 0.66, ny)
  lerpInto(out, tmp.copy(PAL.roche).lerp(PAL.rocheOmbre, 0.25 + 0.3 * n2), rock)
  lerpInto(out, PAL.herbeOmbre, rock * smoothstep(0.7, 0.8, ny) * mossZone * 0.4)

  const ventR = Math.hypot(x - VENT.x, z - VENT.z)
  const vent = 1 - smoothstep(150, 290, ventR)
  lerpInto(out, tmp.copy(PAL.fumee).multiplyScalar(0.72).lerp(PAL.rocheOmbre, 0.25 * n1 + 0.1), vent)
  lerpInto(out, PAL.coeur, (1 - smoothstep(14, 40, ventR)) * 0.55)

  const bw = blancWeight(z)
  lerpInto(out, tmp2.copy(PAL.blanc).lerp(PAL.blancOmbre, 0.4 + 0.8 * (1 - ny) + 0.2 * n2), bw * 0.95)

  const bright = 0.95 + 0.08 * n2
  out.r *= bright
  out.g *= bright
  out.b *= bright
  return out
}

export function makeMaterial(
  ctx: GameContext,
  params: { color: number; vertexColors?: boolean; emissive?: number; onShader?: (s: THREE.WebGLProgramParametersWithUniforms) => void },
): THREE.Material {
  const render = ctx.services.render
  if (render) {
    return render.cel({
      color: params.color,
      vertexColors: params.vertexColors ?? false,
      caustics: true,
      ...(params.emissive !== undefined ? { emissive: params.emissive } : {}),
      ...(params.onShader ? { onShader: params.onShader } : {}),
    })
  }
  return new THREE.MeshLambertMaterial({
    color: params.color,
    vertexColors: params.vertexColors ?? false,
    ...(params.emissive !== undefined ? { emissive: params.emissive } : {}),
  })
}
