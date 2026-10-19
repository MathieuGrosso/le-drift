import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PROPS } from '../../core/tuning'
import { PROP_MODELS, type PropModel, type PropSpec } from './kit'
import { instanceGlow, lightAt, skyAt, type BakeLamp, type SkyBake } from './glow'

export interface PropLight { near: (x: number, y: number, z: number) => readonly BakeLamp[]; base: THREE.Color; sky: SkyBake | null }

const URLS: Record<PropModel, string> = {
  'plante-pot': new URL('../../../assets/props/pottedPlant.glb', import.meta.url).href,
  'plante-1': new URL('../../../assets/props/plantSmall1.glb', import.meta.url).href,
  'plante-2': new URL('../../../assets/props/plantSmall2.glb', import.meta.url).href,
  'plante-3': new URL('../../../assets/props/plantSmall3.glb', import.meta.url).href,
  chaise: new URL('../../../assets/props/chair.glb', import.meta.url).href,
  'chaise-ronde': new URL('../../../assets/props/chairRounded.glb', import.meta.url).href,
  tabouret: new URL('../../../assets/props/stoolBar.glb', import.meta.url).href,
  livres: new URL('../../../assets/props/books.glb', import.meta.url).href,
  radio: new URL('../../../assets/props/radio.glb', import.meta.url).href,
  lampe: new URL('../../../assets/props/lampRoundTable.glb', import.meta.url).href,
}

// One vertex-coloured geometry per model, unit height, base at y = 0.
async function loadModel(loader: GLTFLoader, url: string): Promise<THREE.BufferGeometry> {
  const gltf = await loader.loadAsync(url)
  gltf.scene.updateMatrixWorld(true)
  const parts: THREE.BufferGeometry[] = []
  const color = new THREE.Color()
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const src = (o.geometry as THREE.BufferGeometry).index ? (o.geometry as THREE.BufferGeometry).toNonIndexed() : (o.geometry as THREE.BufferGeometry).clone()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', src.getAttribute('position'))
    g.setAttribute('normal', src.getAttribute('normal'))
    g.applyMatrix4(o.matrixWorld)
    const mat = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial
    color.copy(mat.color ?? color.set(0xffffff))
    const n = g.getAttribute('position').count
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) color.toArray(cols, i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    parts.push(g)
  })
  const geo = mergeGeometries(parts)
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const h = Math.max(1e-3, box.max.y - box.min.y)
  geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).scale(1 / h, 1 / h, 1 / h)
  return geo
}

let cache: Promise<Map<PropModel, THREE.BufferGeometry>> | null = null

export function loadProps(): Promise<Map<PropModel, THREE.BufferGeometry>> {
  cache ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const geos = await Promise.all(PROP_MODELS.map((m) => loadModel(loader, URLS[m])))
    return new Map(PROP_MODELS.map((m, i) => [m, geos[i]!]))
  })()
  return cache
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const UP = new THREE.Vector3(0, 1, 0)

// One instanced mesh per model, lit by the district's baked lamps at each instance.
export function propMeshes(specs: readonly PropSpec[], geos: ReadonlyMap<PropModel, THREE.BufferGeometry>, material: THREE.Material, light: PropLight): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = []
  for (const model of PROP_MODELS) {
    const list = specs.filter((s) => s.model === model)
    if (list.length === 0) continue
    const geo = geos.get(model)!.clone()
    const glow = new Float32Array(list.length * 3)
    const sky = new Float32Array(list.length)
    const im = new THREE.InstancedMesh(geo, material, list.length)
    list.forEach((s, i) => {
      im.setMatrixAt(i, _m.compose(_p.set(s.x, s.y, s.z), _q.setFromAxisAngle(UP, s.yaw), _s.setScalar(s.height)))
      const cy = s.y + s.height * PROPS.lightProbe
      lightAt(s.x, cy, s.z, 0, 1, 0, light.near(s.x, cy, s.z), light.base, _c).toArray(glow, i * 3)
      sky[i] = skyAt(cy, 1, light.sky)
    })
    instanceGlow(geo, glow, sky)
    im.name = `accessoires:${model}`
    out.push(im)
  }
  return out
}
