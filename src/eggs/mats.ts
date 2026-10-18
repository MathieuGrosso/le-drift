import * as THREE from 'three'
import type { CelMaterialParams, GameContext } from '../core/types'

export type MatFn = (p: CelMaterialParams) => THREE.Material

export function createMat(ctx: GameContext): MatFn {
  const cache = new Map<string, THREE.Material>()
  return (p) => {
    const key = p.map ? '' : JSON.stringify(p)
    const hit = key ? cache.get(key) : undefined
    if (hit) return hit
    let m: THREE.Material
    try {
      m = ctx.services.render ? ctx.services.render.cel(p) : lambert(p)
    } catch {
      m = lambert(p)
    }
    if (key) cache.set(key, m)
    return m
  }
}

function lambert(p: CelMaterialParams): THREE.Material {
  return new THREE.MeshLambertMaterial({
    color: p.color,
    map: p.map ?? null,
    emissive: p.emissive ?? 0,
    side: p.side ?? THREE.FrontSide,
    transparent: p.transparent ?? false,
  })
}

export function glow(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false })
}

let haloTex: THREE.CanvasTexture | null = null

export function halo(color: number, size: number): THREE.Sprite {
  if (!haloTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    haloTex = new THREE.CanvasTexture(c)
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }))
  s.scale.setScalar(size)
  return s
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}
