import { SEED } from '../core/layout'

function hash2(ix: number, iz: number, salt: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ Math.imul(SEED + salt, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function valueNoise(x: number, z: number, salt = 0): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10)
  const a = hash2(ix, iz, salt)
  const b = hash2(ix + 1, iz, salt)
  const c = hash2(ix, iz + 1, salt)
  const d = hash2(ix + 1, iz + 1, salt)
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1
}

export function fbm(x: number, z: number, octaves: number, salt = 0): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    const r = o * 0.5
    const cx = x * f + r * 17.3
    const cz = z * f - r * 9.1
    sum += amp * valueNoise(cx * 0.8 - cz * 0.6, cx * 0.6 + cz * 0.8, salt + o * 31)
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}

export function ridged(x: number, z: number, octaves: number, salt = 0): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  let weight = 1
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(valueNoise(x * f, z * f, salt + o * 53))
    n *= n
    n *= weight
    weight = Math.min(1, n * 1.6)
    sum += amp * n
    norm += amp
    amp *= 0.5
    f *= 2.1
  }
  return sum / norm
}

export function hash01(a: number, b: number, salt = 0): number {
  return hash2(a, b, salt)
}
