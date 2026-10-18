import type { Domes, Gp } from '../context'
import { DISTRICT_NAMES, DOME_NAMES, PROMPTS, UI } from '../text/fr'
import { DOME_DISTRICT, MAP_DOMES } from './sites'
import type { Uses } from './uses'

// Dômes de veille: drift builds the tower and its `lunette-<domeId>`; looking through it draws the district on the plan.
export function createDomes(gp: Gp, uses: Uses): Domes {
  const ctx = gp.ctx
  const activated = (id: string) => gp.progress().domes.includes(id)
  let busy = false

  const available = (id: string) => {
    const s = ctx.state
    if (id === 'dome-ecluse') return true
    if (id === 'vigie' || id === 'dome-proue') return s.act >= 3
    return s.act >= 2
  }

  const vista = async (id: string) => {
    const where = gp.sites.where(`lunette-${id}`) ?? gp.heroLocal()
    const down = id === 'dome-machines'
    const yaw0 = ctx.state.hero.yaw - ctx.state.drift.heading
    const eye = { x: where.x, y: where.y + 1.55, z: where.z }
    const steps = 240
    for (let i = 0; i < steps; i++) {
      const k = i / steps
      const a = yaw0 + (k - 0.5) * 1.6
      const dx = Math.sin(a)
      const dz = -Math.cos(a)
      const pos = gp.toWorld({ x: eye.x - dx * 1.4, y: eye.y + (down ? 0.6 : 0.4 + k * 0.8), z: eye.z - dz * 1.4 })
      const tgt = down
        ? gp.toWorld({ x: eye.x + dx * 2, y: eye.y - 40, z: eye.z + dz * 2 })
        : gp.toWorld({ x: eye.x + dx * 80, y: eye.y - 8 - k * 6, z: eye.z + dz * 80 })
      gp.camera.set({ position: pos, target: tgt, fov: 60 })
      await gp.cine.wait(1 / 60)
    }
    gp.camera.set(null)
  }

  const activate = async (id: string) => {
    if (busy) return
    if (!available(id)) {
      gp.toast(UI.domePasEncore)
      return
    }
    if (activated(id)) {
      gp.chart.open('plan')
      return
    }
    busy = true
    gp.lock.count++
    try {
      gp.heroMode('cutscene')
      gp.sfx('dome')
      gp.cue('wonder')
      const prog = gp.progress()
      prog.domes.push(id)
      const district = DOME_DISTRICT[id] ?? 'ecluse'
      const tube = `tube-${district}`
      if (!prog.tubes.includes(tube)) prog.tubes.push(tube)
      gp.emit('dome:activated', { domeId: id, district })
      void gp.cine.card(DOME_NAMES[id] ?? id, DISTRICT_NAMES[district], 4)
      await vista(id)
      await gp.chart.reveal(id)
      gp.toast(`${UI.domeSous} : ${DISTRICT_NAMES[district]}`)
      ctx.save.write()
    } finally {
      gp.heroMode('idle')
      gp.lock.count--
      busy = false
    }
  }

  uses.on(/^lunette-/, (owner) => {
    const id = owner.slice('lunette-'.length)
    if ((id === 'vigie' || id === 'dome-proue') && gp.quests.step('a3-ligne') === 'lunette') {
      return { label: PROMPTS.lunette, kind: 'lunette', run: () => void gp.ending.play() }
    }
    if (id === 'vigie') return { label: PROMPTS.lunette, kind: 'lunette', run: () => gp.chart.open('mer') }
    return { label: PROMPTS.lunette, kind: 'lunette', run: () => void activate(id) }
  })

  return {
    activated,
    count: (ex = false) => gp.progress().domes.filter((d) => (MAP_DOMES as readonly string[]).includes(d) && !(ex && d === 'dome-ecluse')).length,
  }
}
