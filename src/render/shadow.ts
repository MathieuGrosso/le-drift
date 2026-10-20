import * as THREE from 'three'
import type { InternalUniforms } from './uniforms'

const HALF = 60
const BACK = 300
const BIG_INSTANCES = 4000

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)

export interface ShadowPass {
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, center: THREE.Vector3, sunDir: THREE.Vector3): void
  setSize(size: number): void
  dispose(): void
}

function casts(o: THREE.Object3D): boolean {
  if (o.userData.noShadow === true) return false
  if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) return false
  const inst = o as THREE.InstancedMesh
  if (inst.isInstancedMesh && inst.count > BIG_INSTANCES) return false
  const m = (o as THREE.Mesh).material
  if (m) {
    const first = Array.isArray(m) ? m[0] : m
    if (first?.transparent || first?.userData.celIndoor === true) return false
  }
  return true
}

export function createShadowPass(uniforms: InternalUniforms, initialSize: number): ShadowPass {
  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 1, BACK * 2)
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide })
  let target: THREE.WebGLRenderTarget | null = null
  const hidden: THREE.Object3D[] = []
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const snapped = new THREE.Vector3()

  const setSize = (size: number) => {
    target?.dispose()
    target = null
    if (size <= 0) {
      uniforms.rdShadowOn.value = 0
      uniforms.rdShadowMap.value = null
      return
    }
    const depth = new THREE.DepthTexture(size, size, THREE.UnsignedIntType)
    target = new THREE.WebGLRenderTarget(size, size, { depthTexture: depth, depthBuffer: true })
    uniforms.rdShadowMap.value = depth
    uniforms.rdShadowTexel.value = 1 / size
  }
  setSize(initialSize)

  return {
    setSize,
    render(renderer, scene, center, sunDir) {
      if (!target) return
      const size = target.width
      cam.up.set(0, 1, 0)
      if (Math.abs(sunDir.y) > 0.99) cam.up.set(0, 0, -1)
      cam.position.copy(center).addScaledVector(sunDir, BACK)
      cam.lookAt(center)
      cam.updateMatrixWorld()
      right.setFromMatrixColumn(cam.matrixWorld, 0)
      up.setFromMatrixColumn(cam.matrixWorld, 1)
      const texel = (HALF * 2) / size
      const a = center.dot(right)
      const b = center.dot(up)
      snapped.copy(center)
        .addScaledVector(right, Math.round(a / texel) * texel - a)
        .addScaledVector(up, Math.round(b / texel) * texel - b)
      cam.position.copy(snapped).addScaledVector(sunDir, BACK)
      cam.lookAt(snapped)
      cam.updateMatrixWorld()

      scene.traverseVisible((o) => {
        const r = o as THREE.Mesh & { isPoints?: boolean; isLine?: boolean; isSprite?: boolean }
        if ((r.isMesh || r.isPoints || r.isLine || r.isSprite) && !casts(o)) hidden.push(o)
      })
      for (const o of hidden) o.visible = false
      const prevOverride = scene.overrideMaterial
      scene.overrideMaterial = depthMat
      renderer.setRenderTarget(target)
      renderer.clear(false, true, false)
      renderer.render(scene, cam)
      scene.overrideMaterial = prevOverride
      for (const o of hidden) o.visible = true
      hidden.length = 0

      uniforms.rdShadowMatrix.value.copy(BIAS).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse)
      uniforms.rdShadowOn.value = 1
    },
    dispose() {
      target?.dispose()
      depthMat.dispose()
    },
  }
}
