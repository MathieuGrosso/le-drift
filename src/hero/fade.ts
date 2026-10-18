import * as THREE from 'three'

type Fadable = THREE.Mesh & { material: THREE.Material }

interface Entry {
  mesh: Fadable
  original: THREE.Material
  ghost: THREE.Material | null
  value: number
  blocking: boolean
}

function ghostOf(m: THREE.Material): THREE.Material {
  const g = m.clone()
  g.onBeforeCompile = m.onBeforeCompile
  g.customProgramCacheKey = m.customProgramCacheKey
  g.transparent = true
  g.depthWrite = false
  g.userData = m.userData
  return g
}

// Meshes flagged `userData.fadeable` that sit between the camera and Ilo get a transparent twin of their material.
export class WallFade {
  private entries = new Map<THREE.Object3D, Entry>()
  private scanT = 0
  private rayT = 0
  private ray = new THREE.Raycaster()
  private hits: THREE.Intersection[] = []
  private dir = new THREE.Vector3()
  private targets = [new THREE.Vector3(), new THREE.Vector3()]

  constructor(private scene: THREE.Scene, private minOpacity: number) {}

  update(dt: number, cam: THREE.Vector3, chest: THREE.Vector3, head: THREE.Vector3, active: boolean): void {
    this.scanT -= dt
    if (active && this.scanT <= 0) {
      this.scanT = 0.5
      const seen = new Set<THREE.Object3D>()
      this.scene.traverseVisible((o) => {
        if (!o.userData.fadeable) return
        o.traverse((c) => {
          const m = c as Fadable
          if (!m.isMesh || Array.isArray(m.material)) return
          seen.add(m)
          if (!this.entries.has(m)) this.entries.set(m, { mesh: m, original: m.material, ghost: null, value: 1, blocking: false })
        })
      })
      for (const [o, e] of this.entries) if (!seen.has(o) && e.value >= 0.999) this.release(e)
    }
    this.rayT -= dt
    if (this.rayT <= 0) {
      this.rayT = 1 / 15
      this.targets[0]!.copy(chest)
      this.targets[1]!.copy(head)
      for (const e of this.entries.values()) e.blocking = false
      if (active) {
        for (const t of this.targets) {
          this.dir.subVectors(t, cam)
          const len = this.dir.length()
          if (len < 1e-3) continue
          this.ray.set(cam, this.dir.divideScalar(len))
          this.ray.far = Math.max(0, len - 0.25)
          for (const e of this.entries.values()) {
            if (e.blocking || !e.mesh.visible) continue
            this.hits.length = 0
            e.mesh.raycast(this.ray, this.hits)
            if (this.hits.length > 0) e.blocking = true
          }
        }
      }
    }
    for (const e of this.entries.values()) {
      const goal = e.blocking ? this.minOpacity : 1
      e.value += (goal - e.value) * Math.min(1, dt * 9)
      if (e.value < 0.985) {
        if (!e.ghost) e.ghost = ghostOf(e.original)
        e.ghost.opacity = e.value
        if (e.mesh.material !== e.ghost) {
          if (e.mesh.material !== e.original) e.original = e.mesh.material
          e.mesh.material = e.ghost
        }
      } else if (e.mesh.material === e.ghost) {
        e.mesh.material = e.original
        e.value = 1
      }
    }
  }

  private release(e: Entry): void {
    if (e.mesh.material === e.ghost) e.mesh.material = e.original
    e.ghost?.dispose()
    this.entries.delete(e.mesh)
  }

  dispose(): void {
    for (const e of [...this.entries.values()]) this.release(e)
  }
}
