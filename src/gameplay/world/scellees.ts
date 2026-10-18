import * as THREE from 'three'
import type { Gp, Scellees } from '../context'
import { PROMPTS, SCELLEE_TEXT, UI } from '../text/fr'
import { SCELLEES } from './sites'
import type { Uses } from './uses'

// Each coque scellée is one rule over drift's four props: pompe, vanne, levier, nacre (BIBLE §3.1).
// State is gameplay's; drift animates its water plane from 'water:level' and its valve from 'valve:changed'.

interface S { water: number; air: number; valve: boolean; lever: number; pos: number; vel: number; timer: number; seq: string[]; open: boolean }
type Act = 'pompe' | 'vanne' | 'levier'
interface Rule {
  init: Partial<S>
  act(a: Act, s: S): string | void
  tick?(dt: number, s: S): void
  solved(s: S): boolean
  gauge(s: S): string
}

const bar = (v: number, n = 8) => {
  const k = Math.round(THREE.MathUtils.clamp(v, 0, 1) * n)
  return '▮'.repeat(k) + '▯'.repeat(n - k)
}

export function createScellees(gp: Gp, uses: Uses): Scellees {
  const ctx = gp.ctx
  const done = (id: string) => gp.progress().scellees.includes(id)
  const tired = () => !gp.endurance.spend(0.05)
  const gite = () => gp.weather.gite().roll

  const RULES: Record<string, Rule> = {
    'cs-01': {
      init: { water: 1, valve: true },
      act(a, s) {
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') {
          if (tired()) return
          s.water = Math.max(0, s.water - 0.09)
          return s.valve ? UI.cs.fuite : undefined
        }
        if (a === 'levier') return s.water > 0.05 ? UI.sousLEau : undefined
      },
      tick(dt, s) {
        if (s.valve) s.water = Math.min(1, s.water + 0.05 * dt)
      },
      solved: (s) => s.water <= 0.05,
      gauge: (s) => `${UI.cs.eau} ${bar(s.water)}`,
    },
    'cs-02': {
      init: { lever: 0 },
      act(a, s) {
        if (a !== 'levier' && a !== 'pompe') return UI.cs.rien
        if (s.lever >= 1) return
        if (!gp.inv.take('poisson', 1)) return UI.cs.contrepoids
        s.lever = Math.min(1, s.lever + 1 / 3)
        gp.sfx('rope')
        return s.lever >= 1 ? undefined : UI.cs.sac(Math.round(s.lever * 3))
      },
      solved: (s) => s.lever >= 0.99,
      gauge: (s) => `${UI.cs.sacs} ${bar(s.lever, 3)}`,
    },
    'cs-03': {
      init: { water: 0.7, lever: 0, valve: false },
      act(a, s) {
        if (a === 'pompe') {
          if (tired()) return
          s.water = Math.max(0, s.water - 0.12)
        }
        if (a === 'levier') s.lever = s.lever ? 0 : 1
        if (a === 'vanne') {
          if (!s.lever) return UI.cs.noir
          if (s.water > 0.25) return UI.cs.lampeNoyee
          s.valve = true
        }
      },
      solved: (s) => s.valve,
      gauge: (s) => `${UI.cs.eau} ${bar(s.water)} · ${s.lever ? UI.cs.lampeOn : UI.cs.lampeOff}`,
    },
    'cs-04': {
      init: { water: 0.2, valve: false, lever: 0 },
      act(a, s) {
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') {
          if (tired()) return
          s.water = Math.max(0, s.water - 0.1)
        }
        if (a === 'levier') {
          if (s.water < 0.8) return UI.cs.radeauBas
          if (s.water > 0.96) return UI.cs.radeauHaut
          s.lever = 1
        }
      },
      tick(dt, s) {
        if (s.valve) s.water = Math.min(1, s.water + 0.08 * dt)
      },
      solved: (s) => s.lever === 1,
      gauge: (s) => `${UI.cs.canal} ${bar(s.water)}`,
    },
    'cs-05': {
      init: { pos: 0, lever: 0, valve: false },
      act(a, s) {
        if (a === 'levier') s.lever = s.lever ? 0 : 1
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') return UI.cs.rien
        gp.sfx('ballast')
      },
      tick(dt, s) {
        const tilt = (s.lever ? 1 : 0) - (s.valve ? 1 : 0) + gite() * 4
        s.vel = (s.vel + tilt * 0.6 * dt) * Math.exp(-0.8 * dt)
        s.pos += s.vel * dt
        if (s.pos < 0) {
          s.pos = 0
          s.vel = 0
        }
        if (s.pos > 1) {
          s.pos = 1
          s.vel = 0
        }
      },
      solved: (s) => s.pos >= 0.98,
      gauge: (s) => `${UI.cs.tonneau} ${bar(s.pos)}`,
    },
    'cs-06': {
      init: { air: 0, timer: 0 },
      act(a, s) {
        if (a === 'pompe') {
          if (tired()) return
          s.air = Math.min(1, s.air + 0.2)
          gp.sfx('steam')
        }
        if (a === 'vanne') {
          if (s.air < 0.99) return UI.cs.pasAssezVapeur
          s.air = 0
          s.timer = 7
          gp.sfx('steam')
          return UI.cs.vapeur
        }
        if (a === 'levier') return UI.cs.rien
      },
      tick(dt, s) {
        s.timer = Math.max(0, s.timer - dt)
      },
      solved: (s) => s.timer > 0,
      gauge: (s) => (s.timer > 0 ? `${UI.cs.vapeurLabel} ${Math.ceil(s.timer)} s` : `${UI.cs.chaudiere} ${bar(s.air, 5)}`),
    },
    'cs-07': {
      init: { seq: [], air: 0, open: false },
      act(a, s) {
        const want: Act[] = ['vanne', 'pompe', 'pompe', 'pompe', 'levier']
        if (a === 'pompe' && tired()) return
        s.seq.push(a)
        const ok = s.seq.every((x, i) => x === want[i])
        if (!ok) {
          s.seq.length = 0
          s.air = 0
          gp.sfx('steam')
          return UI.cs.pressionFuit
        }
        s.air = s.seq.filter((x) => x === 'pompe').length / 3
        if (s.seq.length === want.length) {
          s.open = true
          gp.sfx('gong')
          gp.sfx('water-rush')
        }
      },
      solved: (s) => s.open,
      gauge: (s) => `${UI.cs.pression} ${bar(s.air, 6)}`,
    },
    'cs-08': {
      init: { lever: 0, air: 0 },
      act(a, s) {
        if (a === 'pompe') {
          if (tired()) return
          s.air = Math.min(1, s.air + 1 / 6)
          gp.sfx('rope')
          return s.air >= 1 ? UI.cs.cageHaut : undefined
        }
        if (a === 'levier') {
          if (s.air < 1) return UI.cs.cageBas
          s.lever = 1
        }
        if (a === 'vanne') {
          s.air = Math.max(0, s.air - 0.5)
          return UI.cs.cageGlisse
        }
      },
      tick(dt, s) {
        if (!s.lever) s.air = Math.max(0, s.air - 0.015 * dt)
      },
      solved: (s) => s.lever === 1,
      gauge: (s) => `${UI.cs.cage} ${bar(s.air, 6)}`,
    },
    'cs-09': {
      init: { valve: false, air: 0, lever: 0 },
      act(a, s) {
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') {
          if (!s.valve) return UI.cs.ligneFermee
          if (tired()) return
          s.air = Math.min(1, s.air + 0.15)
          gp.sfx('bubbles')
        }
        if (a === 'levier') {
          if (s.air < 0.9) return UI.cs.flotteur
          s.lever = 1
        }
      },
      tick(dt, s) {
        s.air = Math.max(0, s.air - (s.valve ? 0.02 : 0.08) * dt)
      },
      solved: (s) => s.lever === 1,
      gauge: (s) => `${UI.cs.bulles} ${bar(s.air)}`,
    },
    'cs-10': {
      init: { air: 0, valve: true, lever: 0 },
      act(a, s) {
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') {
          if (tired()) return
          s.air = Math.min(1, s.air + 0.12)
          gp.sfx('bubbles')
          return s.valve ? UI.cs.joint : undefined
        }
        if (a === 'levier') {
          if (s.air < 0.8) return UI.cs.grilleLourde
          s.lever = 1
        }
      },
      tick(dt, s) {
        if (s.valve) s.air = Math.max(0, s.air - 0.07 * dt)
      },
      solved: (s) => s.lever === 1,
      gauge: (s) => `${UI.cs.cloche} ${bar(s.air)}`,
    },
    'cs-11': {
      init: { water: 0, valve: false, lever: 0 },
      act(a, s) {
        if (a === 'vanne') s.valve = !s.valve
        if (a === 'pompe') {
          if (tired()) return
          s.water = Math.max(0, s.water - 0.12)
        }
        if (a === 'levier') {
          if (s.water < 0.55) return UI.cs.caisseBas
          if (s.water > 0.75) return UI.cs.caisseHaut
          s.lever = 1
        }
      },
      tick(dt, s) {
        if (s.valve) s.water = Math.min(1, s.water + 0.06 * dt)
      },
      solved: (s) => s.lever === 1,
      gauge: (s) => `${UI.cs.eau} ${bar(s.water)} · ${UI.cs.corniche}`,
    },
    'cs-12': {
      init: { lever: 0, pos: 0.5, vel: 0 },
      act(a, s) {
        if (a === 'levier') s.lever = s.lever >= 1 ? -1 : s.lever + 1
        if (a === 'vanne') s.lever = 0
        if (a === 'pompe') return UI.cs.rien
        gp.sfx('ballast')
        return UI.cs.lest(s.lever)
      },
      tick(dt, s) {
        const tilt = s.lever * 0.6 + gite() * 8
        s.vel = (s.vel + tilt * dt) * Math.exp(-0.7 * dt)
        s.pos = THREE.MathUtils.clamp(s.pos + s.vel * dt, 0, 1)
        if (s.pos <= 0 || s.pos >= 1) s.vel = 0
      },
      solved: (s) => s.pos >= 0.98,
      gauge: (s) => `${UI.cs.billes} ${bar(s.pos)} · ${UI.cs.giteDuJour(gite())}`,
    },
  }

  const states = new Map<string, S>()
  const state = (id: string): S => {
    let s = states.get(id)
    if (!s) {
      s = { water: 0, air: 0, valve: false, lever: 0, pos: 0, vel: 0, timer: 0, seq: [], open: false, ...RULES[id]!.init }
      if (done(id)) s.open = true
      states.set(id, s)
    }
    return s
  }
  const solved = (id: string) => done(id) || RULES[id]!.solved(state(id))
  let here: string | null = null
  const lastWater = new Map<string, number>()

  const claim = (id: string) => {
    if (done(id)) return
    gp.progress().scellees.push(id)
    ctx.state.shallows = [...gp.progress().scellees]
    gp.inv.give('nacre', 1, true)
    gp.sfx('chest')
    gp.hud.flashNacre()
    void gp.cine.card(SCELLEE_TEXT[id]?.nom ?? id, UI.scelleeFinie, 3)
    if (gp.inv.count('nacre') >= 4) gp.hud.tip(UI.nacreQuatre, 5)
    gp.emit('scellee:completed', { id })
    ctx.bus.emit('shallow:completed', { id })
    ctx.save.write()
  }

  const act = (id: string, a: Act) => {
    if (done(id)) return
    const msg = RULES[id]!.act(a, state(id))
    const s = state(id)
    if (a === 'pompe') gp.sfx('pump')
    if (a === 'vanne') {
      gp.sfx('valve')
      gp.emit('valve:changed', { id: `vanne-${id}`, open: s.valve })
    }
    if (a === 'levier') gp.sfx('lever')
    if (msg) gp.hud.tip(msg, 3.5)
    if (RULES[id]!.solved(s)) {
      gp.sfx('discovery')
      gp.hud.tip(UI.cs.ouvert, 3)
    }
  }

  for (const kind of ['pompe', 'vanne', 'levier'] as const) {
    uses.on(new RegExp(`^${kind}-cs-\\d\\d$`), (owner) => {
      const id = owner.slice(kind.length + 1)
      if (!RULES[id] || done(id)) return null
      const s = state(id)
      const label = kind === 'pompe' ? PROMPTS.pomper : kind === 'levier' ? PROMPTS.levier : s.valve ? PROMPTS.vanneFermer : PROMPTS.vanneOuvrir
      return { label, kind: kind === 'pompe' ? 'pump' : kind === 'vanne' ? 'valve' : 'lever', run: () => act(id, kind) }
    })
  }
  uses.on(/^nacre-cs-\d\d$/, (owner) => {
    const id = owner.slice('nacre-'.length)
    if (!RULES[id] || done(id)) return null
    return { label: solved(id) ? PROMPTS.nacre : UI.cs.nacreFermee, kind: 'item', run: () => (solved(id) ? claim(id) : gp.hud.tip(SCELLEE_TEXT[id]?.regle ?? '', 3.5)) }
  })

  return {
    done,
    view(id) {
      if (!RULES[id]) return null
      const s = state(id)
      return { water: s.water, air: s.air, valve: s.valve, lever: s.lever, pos: s.pos, timer: s.timer, open: s.open || done(id), solved: solved(id) }
    },
    count: () => gp.progress().scellees.length,
    update(dt) {
      const cell = gp.sites.cellOf(gp.heroLocal())
      const inside = cell && (SCELLEES as readonly string[]).includes(cell) ? cell : null
      if (inside !== here) {
        here = inside
        if (inside) {
          const t = SCELLEE_TEXT[inside]!
          void gp.cine.card(t.nom, done(inside) ? UI.scelleeFinie : t.regle, 3.4)
          gp.emit('scellee:entered', { id: inside })
          ctx.bus.emit('shallow:entered', { id: inside })
          gp.cue('shallow')
        } else gp.cue('drift')
      }
      for (const [id, s] of states) {
        if (done(id)) continue
        RULES[id]!.tick?.(dt, s)
        const w = s.water
        if (Math.abs((lastWater.get(id) ?? -1) - w) > 0.01) {
          lastWater.set(id, w)
          gp.emit('water:level', { cellId: id, level: w })
        }
      }
      gp.hud.counter('scellee', here && !done(here) ? RULES[here]!.gauge(state(here)) : null)
      if (here && !done(here) && solved(here) && !ctx.state.flags[`cs-ouvert:${here}`]) {
        ctx.state.flags[`cs-ouvert:${here}`] = true
        ctx.bus.emit('door:changed', { doorId: `grille-${here}`, open: true })
      }
    },
  }
}
