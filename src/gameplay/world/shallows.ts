import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { CEILING_Y, HAUTS_FONDS, SEUIL, type HautFondDef } from '../../core/layout'
import type { Vec3 } from '../../core/types'
import { dist3, distXZ, type Candidate, type Gp, type ScrubTarget, type Shallows } from '../context'
import { PROMPTS, SHALLOW_NAMES, TIPS, UI } from '../text/fr'
import { addCollider, celMat, disposeMesh, fixedBody, glowMat, removeBody, setInstance, type StaticBody } from './materials'

const DISC_R = 14
const BLANC_IDS = ['hf-09', 'hf-10', 'hf-11'] as const
const COAT = new THREE.Color(0x6f8f4e)
const CLEAN_LENS = new THREE.Color(0xcfefe3)
const CLAM = new THREE.Color(0xb784c9)
const PALE = new THREE.Color(0xf4f1e6)
const ROCK = new THREE.Color(0x9aa5ae)
const MIRROR_TARGET = 3
const RACE_REGROW = 0.05
const RACE_THRESHOLD = 0.4

interface Shrine { def: HautFondDef; index: number; c: Vec3; inside: boolean }
interface Lens { id: string; shrine: Shrine; pos: Vec3; coat: number; regrow: number; index: number }
interface Column { base: Vec3; height: number; radius: number }

export function createShallows(gp: Gp): Shallows {
  const ctx = gp.ctx
  const R = ctx.physics.rapier
  const group = new THREE.Group()
  group.name = 'gameplay-hauts-fonds'
  ctx.scene.add(group)
  const bodies: StaticBody[] = []
  const flags = () => ctx.state.flags

  const shrines: Shrine[] = HAUTS_FONDS.map((def, index) => ({
    def, index, inside: false, c: { x: def.x, y: CEILING_Y - def.topBelowCeiling, z: def.z },
  }))
  const byId = (id: string) => shrines.find((s) => s.def.id === id)!
  const at = (s: Shrine, dx: number, dy: number, dz: number): Vec3 => ({ x: s.c.x + dx, y: s.c.y + dy, z: s.c.z + dz })
  const isOpen = (id: string) => !!flags()[`${id}-ouvert`]
  const isDone = (id: string) => ctx.state.shallows.includes(id)

  const disc = new THREE.InstancedMesh(new THREE.CylinderGeometry(DISC_R, DISC_R + 3, 2, 28), celMat(ctx, { color: 0xffffff, rim: 0.4 }), shrines.length)
  for (const s of shrines) {
    setInstance(disc, s.index, at(s, 0, -1, 0), 1)
    disc.setColorAt(s.index, s.def.z < -650 ? PALE : ROCK)
    const body = fixedBody(ctx, at(s, 0, -1, 0))
    bodies.push({ body, colliders: [addCollider(ctx, body, R.ColliderDesc.cylinder(1, DISC_R + 1.5), 'shrine', true, s.def.id)] })
  }
  group.add(disc)

  const generic = shrines.filter((s) => !(BLANC_IDS as readonly string[]).includes(s.def.id) && s.def.id !== 'hf-12')
  const clamCoat = new Map<string, number>(generic.map((s) => [s.def.id, isOpen(s.def.id) ? 0 : 1]))
  const clams = new THREE.InstancedMesh(new THREE.SphereGeometry(1.3, 16, 10).scale(1, 0.55, 1), celMat(ctx, { color: 0xffffff, rim: 0.7 }), generic.length)
  generic.forEach((s, i) => setInstance(clams, i, at(s, 0, 0.5, 0), 1))
  group.add(clams)

  const pearlMat = new THREE.MeshBasicMaterial({ color: 0xf2eeff })
  ctx.services.render?.patchWater(pearlMat)
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 16, 10), pearlMat, shrines.length)
  pearls.frustumCulled = false
  group.add(pearls)

  const pearlPos = (s: Shrine): Vec3 => {
    if (s.def.id === 'hf-10') return at(s, Math.cos((3 * Math.PI) / 4) * 6, 1.1, Math.sin((3 * Math.PI) / 4) * 6)
    if (s.def.id === 'hf-11') return at(s, -3, 1.1, 3)
    return at(s, 0, 1.1, 0)
  }

  const cageShrines = BLANC_IDS.map((id) => byId(id))
  const cageOpen = new Map<string, number>(cageShrines.map((s) => [s.def.id, isOpen(s.def.id) ? 1 : 0]))
  const cages = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1.4, 1.5, 2.6, 12, 1, true).translate(0, 1.3, 0),
    celMat(ctx, { color: 0xf08a7e, side: THREE.DoubleSide, rim: 0.5 }),
    cageShrines.length,
  )
  group.add(cages)

  const lenses: Lens[] = []
  const race = byId('hf-09')
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3
    lenses.push({ id: `hf-09:lentille-${k}`, shrine: race, pos: at(race, Math.cos(a) * 6, 1.6, Math.sin(a) * 6), coat: isOpen('hf-09') ? 0 : 1, regrow: RACE_REGROW, index: k })
  }
  const ray = byId('hf-10')
  const rayLens: Lens = { id: 'hf-10:lentille', shrine: ray, pos: at(ray, -6, 1.6, 0), coat: isOpen('hf-10') ? 0 : 1, regrow: 0.01, index: 3 }
  lenses.push(rayLens)
  const lensMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 22).rotateZ(Math.PI / 2), celMat(ctx, { color: 0xffffff, rim: 0.9 }), lenses.length + 1)
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 1, 6).translate(0, 0.5, 0), celMat(ctx, { color: 0xd9b48f }), lenses.length + 1)
  for (const l of lenses) {
    const yaw = Math.atan2(l.shrine.c.z - l.pos.z, l.shrine.c.x - l.pos.x)
    setInstance(lensMesh, l.index, l.pos, 1, { y: -yaw })
    setInstance(posts, l.index, { x: l.pos.x, y: l.shrine.c.y, z: l.pos.z }, { x: 1, y: 1.6, z: 1 })
  }
  const mirrorPos = at(ray, 0, 1.6, 0)
  setInstance(posts, lenses.length, { x: mirrorPos.x, y: ray.c.y, z: mirrorPos.z }, { x: 1, y: 1.6, z: 1 })
  setInstance(lensMesh, lenses.length, { x: 0, y: -999, z: 0 }, 0)
  group.add(lensMesh, posts)

  const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 0.16), celMat(ctx, { color: 0xdfe9ff, rim: 1, emissive: 0x223344 }))
  mirror.position.set(mirrorPos.x, mirrorPos.y, mirrorPos.z)
  group.add(mirror)
  let mirrorStep = isOpen('hf-10') ? MIRROR_TARGET : 0
  const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true).translate(0, 0.5, 0), glowMat(0xffe7b0, 0.55), 3)
  beams.frustumCulled = false
  group.add(beams)

  const bell = byId('hf-11')
  const ledgeC = at(bell, 5, 0, 0)
  const LEDGE_H = 8
  const ledge = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.7, LEDGE_H, 14).translate(0, LEDGE_H / 2, 0), celMat(ctx, { color: 0xf4f1e6, rim: 0.5 }))
  ledge.position.set(ledgeC.x, ledgeC.y, ledgeC.z)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 18), celMat(ctx, { color: 0xc9a54b, emissive: 0x332200 }))
  const plateY = ledgeC.y + LEDGE_H + 0.09
  plate.position.set(ledgeC.x, plateY, ledgeC.z)
  group.add(ledge, plate)
  {
    const body = fixedBody(ctx, { x: ledgeC.x, y: ledgeC.y + LEDGE_H / 2, z: ledgeC.z })
    bodies.push({ body, colliders: [addCollider(ctx, body, R.ColliderDesc.cylinder(LEDGE_H / 2, 2.45), 'rock', true, 'hf-11:corniche')] })
  }
  const vent = at(bell, 1.6, 0, 0)
  const stoneHome = at(bell, -3, 0.8, -2.5)
  const stoneMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), celMat(ctx, { color: 0x45507a, rim: 0.5 }))
  group.add(stoneMesh)
  const stoneBody = ctx.physics.world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(stoneHome.x, stoneHome.y, stoneHome.z).setCcdEnabled(true).setLinearDamping(0.4).setAngularDamping(0.8),
  )
  const g = ctx.physics.groups
  const stoneCollider = ctx.physics.world.createCollider(
    R.ColliderDesc.ball(0.6).setDensity(3).setCollisionGroups(((g.FAUNA & 0xffff) << 16) | (g.TERRAIN | g.FAUNA)),
    stoneBody,
  )
  ctx.physics.tag(stoneCollider, { kind: 'prop', climbable: false, ownerId: 'hf-11:pierre' })
  let carrying = false

  const columns: Column[] = [
    { base: vent, height: LEDGE_H + 2.5, radius: 1.3 },
    { base: at(byId('hf-01'), 3, 0, 0), height: 9, radius: 1.3 },
    { base: at(byId('hf-07'), -3, 0, 2), height: 7, radius: 1.1 },
  ]
  const BUBBLES_PER = 90
  const bubbleGeo = new THREE.BufferGeometry()
  const bubblePos = new Float32Array(columns.length * BUBBLES_PER * 3)
  const bubbleSeed = new Float32Array(columns.length * BUBBLES_PER * 3)
  const brng = ctx.rng('bulles')
  for (let i = 0; i < bubbleSeed.length; i++) bubbleSeed[i] = brng()
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3))
  const bubbles = new THREE.Points(
    bubbleGeo,
    new THREE.PointsMaterial({ color: 0xeafcff, size: 0.22, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  bubbles.frustumCulled = false
  group.add(bubbles)

  const repereIds = BLANC_IDS
  const reperes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 1.8, 7).translate(0, 0.9, 0), celMat(ctx, { color: 0xe8674a, emissive: 0x401008 }), repereIds.length)
  group.add(reperes)

  const updateStatics = () => {
    generic.forEach((s, i) => {
      const coat = clamCoat.get(s.def.id) ?? 0
      const c = new THREE.Color().copy(CLAM).lerp(COAT, coat)
      clams.setColorAt(i, c)
      setInstance(clams, i, at(s, 0, 0.5, 0), isOpen(s.def.id) ? { x: 1.15, y: 1.6, z: 1.15 } : 1)
    })
    if (clams.instanceColor) clams.instanceColor.needsUpdate = true
    clams.instanceMatrix.needsUpdate = true
    for (const l of lenses) lensMesh.setColorAt(l.index, new THREE.Color().copy(CLEAN_LENS).lerp(COAT, l.coat))
    lensMesh.setColorAt(lenses.length, CLEAN_LENS)
    if (lensMesh.instanceColor) lensMesh.instanceColor.needsUpdate = true
    repereIds.forEach((id, i) => {
      const placed = ctx.state.chart.reperes.includes(id)
      setInstance(reperes, i, at(byId(id), 2.5, 0, -2.5), placed ? 1 : 0)
    })
    reperes.instanceMatrix.needsUpdate = true
  }
  for (const m of [disc, posts]) m.instanceMatrix.needsUpdate = true
  if (disc.instanceColor) disc.instanceColor.needsUpdate = true
  updateStatics()

  const open = (id: string) => {
    if (isOpen(id)) return
    flags()[`${id}-ouvert`] = true
    gp.sfx('ouverture', byId(id).c)
    gp.cue('wonder')
  }

  const takePearl = (s: Shrine) => {
    if (isDone(s.def.id)) return
    ctx.state.shallows.push(s.def.id)
    gp.inv.give('nacre')
    gp.hud.flashNacre()
    ctx.bus.emit('shallow:completed', { id: s.def.id })
    if (gp.inv.count('nacre') % 4 === 0) gp.hud.tip(UI.nacreQuatre)
  }

  const heroIn = (s: Shrine) => {
    const h = ctx.state.hero.position
    return distXZ(h, s.c) < DISC_R + 8 && h.y > s.c.y - 14
  }

  const forward = () => gp.heroForward()
  const t0 = new THREE.Vector3()
  const t1 = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const qb = new THREE.Quaternion()
  const mtx = new THREE.Matrix4()
  const setBeam = (i: number, a: Vec3 | null, b: Vec3 | null) => {
    if (!a || !b) {
      setInstance(beams, i, { x: 0, y: -999, z: 0 }, 0)
      return
    }
    t0.set(b.x - a.x, b.y - a.y, b.z - a.z)
    const len = t0.length()
    qb.setFromUnitVectors(up, t0.normalize())
    mtx.compose(t1.set(a.x, a.y, a.z), qb, new THREE.Vector3(1, len, 1))
    beams.setMatrixAt(i, mtx)
  }

  let seuilWarned = false
  let staticsTimer = 0
  let time = 0

  const api: Shallows = {
    heroInBubble() {
      const h = ctx.state.hero.position
      return columns.some((c) => distXZ(h, c.base) < c.radius + 0.4 && h.y > c.base.y - 1 && h.y < c.base.y + c.height)
    },
    scrubTargets(out: ScrubTarget[]) {
      const head = gp.headPos()
      for (const s of generic) {
        if (isOpen(s.def.id)) continue
        const d = dist3(head, at(s, 0, 0.6, 0))
        if (d > 2.6) continue
        out.push({
          id: `${s.def.id}:coquille`, dist: d, coat: clamCoat.get(s.def.id) ?? 0,
          scrub: (amount) => {
            const left = Math.max(0, (clamCoat.get(s.def.id) ?? 0) - amount)
            clamCoat.set(s.def.id, left)
            if (left <= 0.02) open(s.def.id)
            return left
          },
        })
      }
      for (const l of lenses) {
        if (isOpen(l.shrine.def.id)) continue
        const d = dist3(head, l.pos)
        if (d > 2.6) continue
        out.push({ id: l.id, dist: d, coat: l.coat, scrub: (amount) => (l.coat = Math.max(0, l.coat - amount)) })
      }
    },
    candidates(out: Candidate[]) {
      const hero = gp.heroPos()
      if (carrying) {
        out.push({
          id: 'hf-11:pierre', kind: 'item', label: PROMPTS.lacher, key: 'interact', dist: 0,
          run: () => {
            carrying = false
            stoneBody.setBodyType(R.RigidBodyType.Dynamic, true)
            stoneCollider.setEnabled(true)
            const f = forward()
            stoneBody.setLinvel({ x: f.x * 1.5, y: 0.5, z: f.z * 1.5 }, true)
          },
        })
        return
      }
      const sp = stoneBody.translation()
      const ds = dist3(hero, sp)
      if (ds < 2.4 && !isOpen('hf-11')) {
        out.push({
          id: 'hf-11:pierre', kind: 'item', label: PROMPTS.prendre, key: 'interact', dist: ds,
          run: () => {
            carrying = true
            stoneCollider.setEnabled(false)
            stoneBody.setBodyType(R.RigidBodyType.KinematicPositionBased, true)
            gp.hud.tip(TIPS.porter(ctx.input.keyLabel('interact')), 3)
          },
        })
      }
      const dm = dist3(hero, mirrorPos)
      if (dm < 2.8 && !isOpen('hf-10')) {
        out.push({
          id: 'hf-10:miroir', kind: 'item', label: PROMPTS.miroir, key: 'interact', dist: dm,
          run: () => {
            mirrorStep = (mirrorStep + 1) % 8
            gp.sfx('miroir', mirrorPos)
          },
        })
      }
      for (const s of shrines) {
        if (isDone(s.def.id) || s.def.id === 'hf-12' || !isOpen(s.def.id)) continue
        const d = dist3(hero, pearlPos(s))
        if (d < 2.6) out.push({ id: `${s.def.id}:nacre`, kind: 'item', label: PROMPTS.nacre, key: 'interact', dist: d, run: () => takePearl(s) })
      }
      if (ctx.state.act === 3 && gp.inv.has('stylo')) {
        for (const id of repereIds) {
          if (ctx.state.chart.reperes.includes(id)) continue
          const d = distXZ(hero, byId(id).c)
          if (d < DISC_R && hero.y > byId(id).c.y - 4) {
            out.push({ id: `${id}:repere`, kind: 'item', label: PROMPTS.repere, key: 'interact', dist: d + 1, run: () => gp.quests.repere(id) })
          }
        }
      }
    },
    update(dt) {
      if (ctx.clock.paused) return
      time += dt
      const st = ctx.state
      const hero = st.hero.position

      for (const s of shrines) {
        const inside = heroIn(s)
        if (inside && !s.inside) {
          ctx.bus.emit('shallow:entered', { id: s.def.id })
          if (s.def.id !== 'hf-12') {
            const t = SHALLOW_NAMES[s.def.id]
            if (t) gp.hud.placeName(t.nom, t.regle)
            gp.cue('shallow')
          }
        } else if (!inside && s.inside) gp.cue('explore')
        s.inside = inside
      }

      if (!isOpen('hf-09')) {
        for (const l of lenses) if (l.shrine === race) l.coat = Math.min(1, l.coat + l.regrow * dt)
        if (lenses.filter((l) => l.shrine === race).every((l) => l.coat < RACE_THRESHOLD)) open('hf-09')
      }
      if (!isOpen('hf-10')) {
        rayLens.coat = Math.min(1, rayLens.coat + rayLens.regrow * dt)
        if (rayLens.coat < 0.3 && mirrorStep === MIRROR_TARGET) open('hf-10')
      }
      mirror.rotation.y = -(mirrorStep * Math.PI) / 8 - Math.PI / 4
      const near10 = dist3(hero, ray.c) < 120
      if (near10) {
        const lensTop = { x: rayLens.pos.x, y: CEILING_Y, z: rayLens.pos.z }
        setBeam(0, lensTop, rayLens.pos)
        if (rayLens.coat < 0.3) {
          setBeam(1, rayLens.pos, mirrorPos)
          const phi = (mirrorStep * Math.PI) / 4
          const len = mirrorStep === MIRROR_TARGET ? 6 : 9
          setBeam(2, mirrorPos, { x: mirrorPos.x + Math.cos(phi) * len, y: mirrorPos.y, z: mirrorPos.z + Math.sin(phi) * len })
        } else {
          setBeam(1, null, null)
          setBeam(2, null, null)
        }
      } else for (let i = 0; i < 3; i++) setBeam(i, null, null)
      beams.instanceMatrix.needsUpdate = true

      if (carrying) {
        const f = forward()
        const target = { x: hero.x + f.x * 0.95, y: hero.y + 0.6, z: hero.z + f.z * 0.95 }
        stoneBody.setNextKinematicTranslation(target)
      } else {
        const p = stoneBody.translation()
        const v = stoneBody.linvel()
        let vy = v.y - 4 * dt
        let vx = v.x
        let vz = v.z
        const col = columns[0]!
        const dv = distXZ(p, col.base)
        if (dv < col.radius && p.y < col.base.y + col.height) vy += 10 * dt
        if (p.y > col.base.y + LEDGE_H - 0.5 && dv < 2.6) {
          vx += (ledgeC.x - p.x) * 2.2 * dt
          vz += (ledgeC.z - p.z) * 2.2 * dt
        }
        vy = Math.max(-3, Math.min(4, vy))
        stoneBody.setLinvel({ x: vx, y: vy, z: vz }, true)
        if (p.y < bell.c.y - 20 || distXZ(p, bell.c) > 45) {
          stoneBody.setTranslation(stoneHome, true)
          stoneBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
        if (!isOpen('hf-11') && distXZ(p, ledgeC) < 1.15 && Math.abs(p.y - (plateY + 0.6)) < 0.9) open('hf-11')
      }
      const sp = stoneBody.translation()
      stoneMesh.position.set(sp.x, sp.y, sp.z)
      const r = stoneBody.rotation()
      stoneMesh.quaternion.set(r.x, r.y, r.z, r.w)

      cageShrines.forEach((s, i) => {
        let t = cageOpen.get(s.def.id) ?? 0
        if (isOpen(s.def.id) && t < 1) t = Math.min(1, t + dt / 1.6)
        cageOpen.set(s.def.id, t)
        const p = pearlPos(s)
        setInstance(cages, i, { x: p.x, y: s.c.y - 2.7 * t, z: p.z }, 1)
      })
      cages.instanceMatrix.needsUpdate = true
      for (const s of shrines) {
        const visible = s.def.id !== 'hf-12' && !isDone(s.def.id) && (isOpen(s.def.id) || cageOpen.has(s.def.id))
        const p = pearlPos(s)
        setInstance(pearls, s.index, { x: p.x, y: p.y + Math.sin(time * 2 + s.index) * 0.12, z: p.z }, visible ? 1 : 0)
      }
      pearls.instanceMatrix.needsUpdate = true

      let anyNear = false
      columns.forEach((c, ci) => {
        const near = dist3(hero, c.base) < 90
        anyNear ||= near
        for (let k = 0; k < BUBBLES_PER; k++) {
          const i = (ci * BUBBLES_PER + k) * 3
          if (!near) {
            bubblePos[i + 1] = -999
            continue
          }
          const s0 = bubbleSeed[i]!
          const s1 = bubbleSeed[i + 1]!
          const s2 = bubbleSeed[i + 2]!
          const h = ((time * (1.2 + s0 * 1.6) + s1 * c.height) % c.height)
          const a = s2 * Math.PI * 2 + time * (0.5 + s0)
          const rr = c.radius * Math.sqrt(s1) * 0.9
          bubblePos[i] = c.base.x + Math.cos(a) * rr
          bubblePos[i + 1] = c.base.y + h
          bubblePos[i + 2] = c.base.z + Math.sin(a) * rr
        }
      })
      bubbles.visible = anyNear
      if (anyNear) (bubbleGeo.attributes['position'] as THREE.BufferAttribute).needsUpdate = true

      staticsTimer -= dt
      if (staticsTimer <= 0) {
        staticsTimer = 0.1
        updateStatics()
      }

      if (st.act === 3 && !st.flags['ending'] && !st.flags['postgame']) {
        const nearSeuil = distXZ(hero, SEUIL) < 26 && hero.y > SEUIL.topY - 16
        if (nearSeuil) {
          if (st.chart.reperes.length >= 3) void gp.ending.play()
          else if (!seuilWarned) {
            seuilWarned = true
            gp.hud.tip(UI.reperesManquants(st.chart.reperes.length))
          }
        } else seuilWarned = false
      }
    },
    dispose() {
      ctx.physics.untag(stoneCollider)
      ctx.physics.world.removeRigidBody(stoneBody as RAPIER.RigidBody)
      for (const b of bodies) removeBody(ctx, b)
      disposeMesh(group)
    },
  }
  return api
}
