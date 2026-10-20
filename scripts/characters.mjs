// Builds assets/characters/*.glb from a Quaternius Universal Base Characters + Universal Animation Library download.
// Usage: npm run characters -- <download-dir>
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { dedup, mergeDocuments, meshopt, prune, resample, unpartition } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'

const SRC = process.argv[2]
if (!SRC) throw new Error('usage: node scripts/characters.mjs <download-dir>')
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'characters')

const BODIES = {
  'ilo.glb': { body: 'Superhero_Male_FullBody', extra: ['Hair_SimpleParted'] },
  'ondine.glb': { body: 'Superhero_Female_FullBody', extra: ['Hair_Long'] },
}
const CLIPS = {
  'UAL1_Standard.glb': [
    'Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
    'Roll', 'Swim_Fwd_Loop', 'Swim_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit', 'Sitting_Talking_Loop',
    'Interact', 'Push_Loop', 'Crouch_Idle_Loop', 'Fixing_Kneeling',
  ],
  'UAL2_Standard.glb': ['Consume', 'Idle_FoldArms_Loop', 'Slide_Loop', 'ClimbUp_1m', 'Idle_Rail_Loop', 'Yes', 'Walk_Carry_Loop'],
}

const FINGER = /^(index|middle|ring|pinky|thumb)_/

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

function readUntextured(name) {
  const json = JSON.parse(readFileSync(join(SRC, `${name}.gltf`), 'utf8'))
  for (const m of json.materials ?? []) {
    delete m.normalTexture
    delete m.occlusionTexture
    delete m.emissiveTexture
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture
      delete m.pbrMetallicRoughness.metallicRoughnessTexture
    }
    delete m.extensions
  }
  delete json.images
  delete json.textures
  delete json.samplers
  const resources = {}
  for (const b of json.buffers) resources[b.uri] = new Uint8Array(readFileSync(join(SRC, b.uri)))
  return io.readJSON({ json, resources })
}

async function shrink(doc) {
  for (const p of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    for (const s of ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'COLOR_0', 'COLOR_1']) {
      const a = p.getAttribute(s)
      if (a) p.setAttribute(s, null)
    }
  }
  await doc.transform(prune(), dedup(), resample(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
}

for (const [file, spec] of Object.entries(BODIES)) {
  const doc = await readUntextured(spec.body)
  const root = doc.getRoot()
  const skin = root.listSkins()[0]
  const jointNames = skin.listJoints().map((j) => j.getName())
  for (const extra of spec.extra) {
    const other = await readUntextured(extra)
    const otherSkin = other.getRoot().listSkins()[0]
    const names = otherSkin.listJoints().map((j) => j.getName())
    if (names.join() !== jointNames.join()) throw new Error(`${extra}: joint order differs from ${spec.body}`)
    mergeDocuments(doc, other)
  }
  const scene = root.listScenes()[0]
  for (const s of root.listScenes().slice(1)) {
    for (const n of s.listChildren()) {
      for (const node of collect(n)) {
        if (node.getMesh() && node.getSkin() && node.getSkin() !== skin) {
          node.setSkin(skin)
          node.setName(node.getMesh().getName())
          scene.addChild(node)
        }
      }
    }
    s.dispose()
  }
  for (const s of root.listSkins()) if (s !== skin) s.dispose()
  await shrink(doc)
  await io.write(join(OUT, file), doc)
  console.log('wrote', file)
}

function collect(node, out = []) {
  out.push(node)
  for (const c of node.listChildren()) collect(c, out)
  return out
}

const anims = new Document()
for (const [file, keep] of Object.entries(CLIPS)) {
  const doc = await io.read(join(SRC, file))
  const root = doc.getRoot()
  for (const a of root.listAnimations()) if (!keep.includes(a.getName())) a.dispose()
  for (const node of root.listNodes()) if (node.getMesh()) node.setMesh(null)
  for (const m of root.listMeshes()) m.dispose()
  for (const a of root.listAnimations()) {
    for (const c of a.listChannels()) {
      const bone = c.getTargetNode()?.getName() ?? ''
      if (c.getTargetPath() === 'scale' || FINGER.test(bone) || (c.getTargetPath() === 'translation' && bone !== 'pelvis')) {
        c.getSampler()?.dispose()
        c.dispose()
      }
    }
  }
  const missing = keep.filter((k) => !root.listAnimations().some((a) => a.getName() === k))
  if (missing.length) throw new Error(`${file}: missing clips ${missing.join(', ')}`)
  mergeDocuments(anims, doc)
}
const firstByName = new Map()
for (const n of anims.getRoot().listNodes()) if (!firstByName.has(n.getName())) firstByName.set(n.getName(), n)
for (const c of anims.getRoot().listAnimations().flatMap((a) => a.listChannels())) c.setTargetNode(firstByName.get(c.getTargetNode().getName()))
for (const s of anims.getRoot().listScenes().slice(1)) s.dispose()
for (const s of anims.getRoot().listSkins()) s.dispose()
await shrink(anims)
await io.write(join(OUT, 'clips.glb'), anims)
console.log('wrote clips.glb')
