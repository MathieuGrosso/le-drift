import type * as THREE from 'three'

const SOFT = { h: 0, s: 0, l: 0 }
export function softColor(c: THREE.Color, k = 0.72): THREE.Color {
  c.getHSL(SOFT)
  return c.setHSL(SOFT.h, SOFT.s * k, SOFT.l)
}
