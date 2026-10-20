import * as THREE from 'three'

export const I0 = 4
export const I1 = 4
export const COL = 3

export class InstanceBuffers {
  readonly i0: Float32Array
  readonly i1: Float32Array
  readonly col: Float32Array
  private readonly a0: THREE.InstancedBufferAttribute
  private readonly a1: THREE.InstancedBufferAttribute
  private readonly ac: THREE.InstancedBufferAttribute

  constructor(readonly capacity: number, geometry: THREE.InstancedBufferGeometry) {
    this.i0 = new Float32Array(capacity * I0)
    this.i1 = new Float32Array(capacity * I1)
    this.col = new Float32Array(capacity * COL)
    this.a0 = new THREE.InstancedBufferAttribute(this.i0, I0).setUsage(THREE.DynamicDrawUsage)
    this.a1 = new THREE.InstancedBufferAttribute(this.i1, I1).setUsage(THREE.DynamicDrawUsage)
    this.ac = new THREE.InstancedBufferAttribute(this.col, COL).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('aFlI0', this.a0)
    geometry.setAttribute('aFlI1', this.a1)
    geometry.setAttribute('aFlCol', this.ac)
  }

  write(
    i: number, x: number, y: number, z: number, yaw: number,
    sx: number, sy: number, phase: number, r: number, g: number, b: number,
  ): void {
    const o0 = i * I0
    const o1 = i * I1
    const oc = i * COL
    this.i0[o0] = x
    this.i0[o0 + 1] = y
    this.i0[o0 + 2] = z
    this.i0[o0 + 3] = yaw
    this.i1[o1] = sx
    this.i1[o1 + 1] = sy
    this.i1[o1 + 2] = phase
    this.i1[o1 + 3] = 0
    this.col[oc] = r
    this.col[oc + 1] = g
    this.col[oc + 2] = b
  }

  copyFrom(src: Float32Array, srcIndex: number, dst: number): void {
    const s = srcIndex * RECORD
    this.write(dst, src[s]!, src[s + 1]!, src[s + 2]!, src[s + 3]!, src[s + 4]!, src[s + 5]!, src[s + 6]!, src[s + 7]!, src[s + 8]!, src[s + 9]!)
  }

  clear(start: number, count: number): void {
    this.i1.fill(0, start * I1, (start + count) * I1)
  }

  uploadRange(start: number, count: number): void {
    if (count <= 0) return
    for (const [a, size] of [[this.a0, I0], [this.a1, I1], [this.ac, COL]] as const) {
      a.addUpdateRange(start * size, count * size)
      a.needsUpdate = true
    }
  }

  uploadAll(count: number): void {
    for (const a of [this.a0, this.a1, this.ac]) a.clearUpdateRanges()
    this.uploadRange(0, count)
  }
}

export const RECORD = 10

// Instances live in custom attributes three cannot measure, so each field fits its own bounds.
export class InstanceBounds {
  private readonly box = new THREE.Box3()

  constructor(private readonly geometry: THREE.InstancedBufferGeometry) {
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity)
    geometry.boundingBox = new THREE.Box3()
  }

  reset(): void {
    this.box.makeEmpty()
  }

  add(x: number, y0: number, y1: number, z: number, reach: number): void {
    const b = this.box
    b.min.set(Math.min(b.min.x, x - reach), Math.min(b.min.y, y0 - reach), Math.min(b.min.z, z - reach))
    b.max.set(Math.max(b.max.x, x + reach), Math.max(b.max.y, y1 + reach), Math.max(b.max.z, z + reach))
  }

  commit(): void {
    this.geometry.boundingBox!.copy(this.box)
    this.box.getBoundingSphere(this.geometry.boundingSphere!)
  }
}

export function makeMesh(geometry: THREE.InstancedBufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.matrixAutoUpdate = false
  mesh.userData.flora = true
  mesh.userData.noShadow = true
  return mesh
}
