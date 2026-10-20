import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { BoneName } from './model'

export type BodyId = 'ilo'

const URLS: Record<BodyId | 'clips', string> = {
  ilo: new URL('../../assets/characters/ilo.glb', import.meta.url).href,
  clips: new URL('../../assets/characters/clips.glb', import.meta.url).href,
}

// The glTF bodies are 1.81 m adults: `height` scales the source, `arm` shortens the arms so Ilo reads as a boy.
const SOURCE_HEIGHT = 1.81
export const BODY = {
  ilo: { height: 1.42, slim: 0.86, arm: 0.9 },
} as const satisfies Record<BodyId, { height: number; slim: number; arm: number }>

export const UAL_BONE: Partial<Record<BoneName, string>> = {
  hips: 'pelvis', spine: 'spine_01', chest: 'spine_03', neck: 'neck_01', head: 'Head',
  upperArmL: 'upperarm_l', foreArmL: 'lowerarm_l', handL: 'hand_l',
  upperArmR: 'upperarm_r', foreArmR: 'lowerarm_r', handR: 'hand_r',
  thighL: 'thigh_l', shinL: 'calf_l', footL: 'foot_l',
  thighR: 'thigh_r', shinR: 'calf_r', footR: 'foot_r',
}

// Arms hang in the procedural rest pose; the glTF bind is a T-pose, so arms are swung down first.
const HANG: ReadonlyArray<readonly [bone: string, child: string, dir: readonly [number, number, number]]> = [
  ['upperarm_l', 'lowerarm_l', [-0.12, -1, 0]], ['lowerarm_l', 'hand_l', [-0.05, -1, 0]], ['hand_l', 'middle_01_l', [0, -1, 0]],
  ['upperarm_r', 'lowerarm_r', [0.12, -1, 0]], ['lowerarm_r', 'hand_r', [0.05, -1, 0]], ['hand_r', 'middle_01_r', [0, -1, 0]],
]

export interface CharacterKit {
  bodies: Record<BodyId, THREE.Group>
  clips: Map<string, THREE.AnimationClip>
}

let kit: CharacterKit | null = null
let pending: Promise<CharacterKit> | null = null

export function loadCharacterKit(): Promise<CharacterKit> {
  if (kit) return Promise.resolve(kit)
  pending ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const [ilo, clips] = await Promise.all([loader.loadAsync(URLS.ilo), loader.loadAsync(URLS.clips)])
    const map = new Map<string, THREE.AnimationClip>()
    for (const c of clips.animations) map.set(c.name, inPlace(c))
    kit = { bodies: { ilo: ilo.scene }, clips: map }
    return kit
  })()
  return pending
}

export function characterKit(): CharacterKit {
  if (!kit) throw new Error('character kit not loaded')
  return kit
}

function inPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.position')) continue
    const v = t.values
    for (let i = 3; i < v.length; i += 3) {
      v[i] = v[0]!
      v[i + 1] = v[1]!
    }
  }
  return clip
}

// rooted: the clip's pelvis translation is dropped so the body turns about the hips, not the clip's floor.
interface MocapSpec { clip: string; once?: boolean; speed?: number; rooted?: boolean }

const MOCAP: Partial<Record<string, MocapSpec>> = {
  idle: { clip: 'Idle_Loop' }, 'idle-dry': { clip: 'Idle_Loop' }, 'idle-floor': { clip: 'Idle_Loop' },
  walk: { clip: 'Walk_Loop', speed: 1.5 }, 'walk-dry': { clip: 'Walk_Loop', speed: 1.5 },
  run: { clip: 'Jog_Fwd_Loop', speed: 3.6 }, 'run-dry': { clip: 'Jog_Fwd_Loop', speed: 3.6 },
  sprint: { clip: 'Sprint_Loop', speed: 5.5 },
  jump: { clip: 'Jump_Start', once: true }, fall: { clip: 'Jump_Loop' },
  land: { clip: 'Jump_Land', once: true }, 'land-dry': { clip: 'Jump_Land', once: true },
  roll: { clip: 'Roll', once: true },
  swim: { clip: 'Swim_Fwd_Loop', speed: 1.4, rooted: true }, 'swim-sprint': { clip: 'Swim_Fwd_Loop', speed: 1.0, rooted: true },
  tread: { clip: 'Swim_Idle_Loop', rooted: true },
  'sit-down': { clip: 'Sitting_Enter', once: true }, sit: { clip: 'Sitting_Idle_Loop' }, 'stand-up': { clip: 'Sitting_Exit', once: true },
  talk: { clip: 'Idle_Talking_Loop' }, eat: { clip: 'Consume', once: true },
  'open-hatch': { clip: 'Interact', once: true }, 'clip-ring': { clip: 'Interact', once: true }, pump: { clip: 'Push_Loop' },
  slide: { clip: 'Slide_Loop' }, 'carry-walk': { clip: 'Walk_Carry_Loop', speed: 1.4 }, lean: { clip: 'Idle_Rail_Loop' },
}

const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()
const va = new THREE.Vector3()
const vb = new THREE.Vector3()

export interface CharacterRigOptions {
  body: BodyId
  pose: Record<BoneName, THREE.Bone>
  rest: Record<BoneName, THREE.Vector3>
}

/** A Quaternius body driven by the procedural hero poses, crossfaded with Universal Animation Library mocap. */
export class CharacterRig {
  readonly group: THREE.Group
  readonly meshes: THREE.SkinnedMesh[] = []
  readonly sockets = {} as Record<BoneName, THREE.Bone>
  readonly bones: THREE.Bone[]
  readonly byName = new Map<string, THREE.Bone>()
  private readonly parentIdx: number[]
  private readonly mapped: (BoneName | null)[]
  private readonly refLocal: THREE.Quaternion[]
  private readonly bindW: THREE.Quaternion[]
  private readonly world: THREE.Quaternion[]
  private readonly procLocal: THREE.Quaternion[]
  private readonly procW = {} as Record<BoneName, THREE.Quaternion>
  private readonly baseQ = new THREE.Quaternion()
  private readonly pelvisRef = new THREE.Vector3()
  private readonly pelvisUp = new THREE.Vector3()
  private readonly mixer: THREE.AnimationMixer
  private action: THREE.AnimationAction | null = null
  private spec: MocapSpec | null = null
  private wProc = 1
  readonly scale: number

  constructor(private readonly opts: CharacterRigOptions) {
    const template = characterKit().bodies[opts.body]
    const inst = cloneSkinned(template) as THREE.Group
    const spec = BODY[opts.body]
    this.scale = spec.height / SOURCE_HEIGHT
    this.group = new THREE.Group()
    this.group.rotation.y = Math.PI
    this.group.scale.set(this.scale * spec.slim, this.scale, this.scale * spec.slim)
    this.group.add(inst)
    inst.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh
        m.geometry = m.geometry.clone()
        m.frustumCulled = false
        this.meshes.push(m)
      }
    })
    const skel = this.meshes[0]!.skeleton
    this.bones = skel.bones
    for (const b of this.bones) this.byName.set(b.name, b)
    for (const side of ['l', 'r']) this.byName.get(`upperarm_${side}`)?.scale.setScalar(spec.arm)
    this.parentIdx = this.bones.map((b) => this.bones.indexOf(b.parent as THREE.Bone))
    const mappedBy = new Map(Object.entries(UAL_BONE).map(([k, v]) => [v, k as BoneName]))
    this.mapped = this.bones.map((b) => mappedBy.get(b.name) ?? null)
    for (const [bone, child, dir] of HANG) this.aim(bone, child, new THREE.Vector3(dir[0], dir[1], dir[2]).normalize())
    this.group.updateMatrixWorld(true)
    this.refLocal = this.bones.map((b) => b.quaternion.clone())
    const root = this.bones[0]!
    root.parent!.updateWorldMatrix(true, false)
    this.baseQ.copy(this.worldQ(root.parent!))
    this.bindW = this.bones.map((b) => this.worldQ(b))
    this.world = this.bones.map(() => new THREE.Quaternion())
    this.procLocal = this.bones.map(() => new THREE.Quaternion())
    for (const n of Object.keys(opts.pose) as BoneName[]) this.procW[n] = new THREE.Quaternion()
    const pelvis = this.byName.get('pelvis')!
    this.pelvisRef.copy(pelvis.position)
    qa.copy(this.worldQ(pelvis.parent!)).invert()
    this.pelvisUp.set(0, 1 / this.scale, 0).applyQuaternion(qa)
    for (let i = 0; i < this.bones.length; i++) {
      const name = this.mapped[i]
      if (!name) continue
      const b = this.bones[i]!
      const s = new THREE.Bone()
      s.name = `socket-${name}`
      s.quaternion.copy(this.bindW[i]!).invert()
      b.getWorldScale(vb)
      s.scale.set(1 / vb.x, 1 / vb.y, 1 / vb.z)
      b.add(s)
      this.sockets[name] = s
    }
    this.sockets.root = this.sockets.hips
    this.mixer = new THREE.AnimationMixer(inst)
    this.group.updateMatrixWorld(true)
  }

  private worldQ(o: THREE.Object3D): THREE.Quaternion {
    const q = new THREE.Quaternion()
    let n: THREE.Object3D | null = o
    while (n && n !== this.group.parent) {
      q.premultiply(n.quaternion)
      n = n.parent
    }
    return q
  }

  private aim(bone: string, child: string, dir: THREE.Vector3): void {
    const b = this.byName.get(bone)
    const c = this.byName.get(child)
    if (!b || !c) return
    this.group.updateMatrixWorld(true)
    b.getWorldPosition(va)
    c.getWorldPosition(vb)
    const rot = new THREE.Quaternion().setFromUnitVectors(vb.sub(va).normalize(), dir)
    const bw = this.worldQ(b)
    const pw = this.worldQ(b.parent!)
    b.quaternion.copy(pw.invert().multiply(rot.multiply(bw)))
  }

  /** Pose the body from the procedural skeleton, fading to mocap for clips the library covers. */
  update(dt: number, clip: string, fade: number, speed: number, hipsY: number): void {
    const spec = MOCAP[clip] ?? null
    if (spec?.clip !== this.spec?.clip || (spec?.once && spec !== this.spec)) this.switchTo(spec, fade)
    this.spec = spec
    if (this.action && spec?.speed) this.action.timeScale = THREE.MathUtils.clamp(speed / spec.speed, 0.6, 1.6)
    const target = spec ? 0 : 1
    const rate = dt / Math.max(fade, 0.05)
    this.wProc += THREE.MathUtils.clamp(target - this.wProc, -rate, rate)
    this.mixer.update(dt)

    const pose = this.opts.pose
    for (const n of Object.keys(pose) as BoneName[]) {
      const b = pose[n]
      const p = b.parent as THREE.Bone | null
      const w = this.procW[n]
      if (p && p.isBone) w.copy(this.procW[p.name as BoneName]).multiply(b.quaternion)
      else w.copy(b.quaternion)
    }
    const k = this.wProc
    for (let i = 0; i < this.bones.length; i++) {
      const pi = this.parentIdx[i]!
      const parentW = pi < 0 ? this.baseQ : this.world[pi]!
      const name = this.mapped[i]
      const local = this.procLocal[i]!
      if (name) {
        qb.copy(this.procW[name]).multiply(this.bindW[i]!)
        local.copy(qa.copy(parentW).invert().multiply(qb))
      } else local.copy(this.refLocal[i]!)
      const bone = this.bones[i]!
      if (k >= 0.999) bone.quaternion.copy(local)
      else if (k > 0.001) bone.quaternion.slerp(local, k)
      this.world[i]!.copy(parentW).multiply(bone.quaternion)
    }
    const pelvis = this.byName.get('pelvis')!
    va.copy(this.pelvisRef).addScaledVector(this.pelvisUp, hipsY)
    if (k >= 0.999 || spec?.rooted) pelvis.position.copy(va)
    else if (k > 0.001) pelvis.position.lerp(va, k)
  }

  private switchTo(spec: MocapSpec | null, fade: number): void {
    const next = spec ? this.mixer.clipAction(characterKit().clips.get(spec.clip)!) : null
    if (next) {
      next.reset()
      next.setLoop(spec?.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = !!spec?.once
      next.timeScale = 1
      next.play()
      if (this.action && this.action !== next) next.crossFadeFrom(this.action, Math.max(fade, 0.1), false)
      else next.fadeIn(Math.max(fade, 0.1))
    } else this.action?.fadeOut(Math.max(fade, 0.1))
    this.action = next
  }

  boneIndex(name: string): number {
    const i = this.bones.findIndex((b) => b.name === name)
    if (i < 0) throw new Error(`character rig has no bone ${name}`)
    return i
  }

  private mesh(name: string): THREE.SkinnedMesh {
    const m = this.meshes.find((x) => x.name === name)
    if (!m) throw new Error(`character rig has no mesh ${name}`)
    return m
  }

  /** Rest-pose vertices of a body mesh in armature space (glTF units, +y up, +z forward), with their dominant bone. */
  restPoints(meshName: string): { p: THREE.Vector3; bone: string }[] {
    const m = this.mesh(meshName)
    this.group.updateMatrixWorld(true)
    const out: { p: THREE.Vector3; bone: string }[] = []
    for (let i = 0; i < m.geometry.getAttribute('position').count; i++) out.push({ p: m.getVertexPosition(i, new THREE.Vector3()), bone: dominantBone(m, i) })
    return out
  }

  /** Skins a part authored in `restPoints` space; its skinIndex attribute uses `boneIndex`. */
  addSkinned(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.SkinnedMesh {
    const host = this.meshes[0]!
    const m = new THREE.SkinnedMesh(geometry, material)
    m.frustumCulled = false
    host.parent!.add(m)
    this.group.updateMatrixWorld(true)
    m.bind(new THREE.Skeleton(this.bones), m.matrixWorld)
    this.meshes.push(m)
    return m
  }

  /** Drops the triangles of `meshName` that lie wholly on `bone`, so a stylised part can replace them. */
  dropBone(meshName: string, bone: string): void {
    const m = this.mesh(meshName)
    const ix = m.geometry.index
    if (!ix) throw new Error(`${meshName} is not indexed`)
    const on = new Uint8Array(m.geometry.getAttribute('position').count)
    for (let i = 0; i < on.length; i++) on[i] = dominantBone(m, i) === bone ? 1 : 0
    const kept: number[] = []
    for (let t = 0; t < ix.count; t += 3) {
      const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2)
      if (!(on[a] && on[b] && on[c])) kept.push(a, b, c)
    }
    m.geometry.setIndex(kept)
  }

  removeMesh(meshName: string): void {
    const m = this.mesh(meshName)
    m.removeFromParent()
    m.geometry.dispose()
    this.meshes.splice(this.meshes.indexOf(m), 1)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    for (const m of this.meshes) m.geometry.dispose()
  }
}

function dominantBone(m: THREE.SkinnedMesh, i: number): string {
  const si = m.geometry.getAttribute('skinIndex')
  const sw = m.geometry.getAttribute('skinWeight')
  let best = 0
  for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
  return m.skeleton.bones[si.getComponent(i, best)]?.name ?? ''
}

export interface VertexInfo {
  mesh: string
  bone: string
  /** Bind-pose position in glTF body units (1.81 m tall), facing -z, before height and slim. */
  p: THREE.Vector3
  centre: THREE.Vector3
}
export type Look = (v: VertexInfo, out: THREE.Color) => boolean

/** Paints `color` + `aMat` (skin flag) for the toon hero shader, from bind-pose position and dominant bone. */
export function paintRig(rig: CharacterRig, look: Look): void {
  rig.group.updateMatrixWorld(true)
  const c = new THREE.Color()
  const info: VertexInfo = { mesh: '', bone: '', p: new THREE.Vector3(), centre: new THREE.Vector3() }
  const unit = rig.group.scale.clone()
  for (const m of rig.meshes) {
    const g = m.geometry
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    const mat = new Float32Array(n * 4)
    info.mesh = m.name
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) pts.push(m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld))
    info.centre.set(0, 0, 0)
    for (const p of pts) info.centre.add(p)
    info.centre.divideScalar(Math.max(n, 1))
    for (let i = 0; i < n; i++) {
      info.bone = dominantBone(m, i)
      info.p.copy(pts[i]!).divide(unit)
      const skin = look(info, c)
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
      if (skin) mat[i * 4] = 1
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aMat', new THREE.BufferAttribute(mat, 4))
  }
}
