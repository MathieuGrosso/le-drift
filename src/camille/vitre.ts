import * as THREE from 'three'
import { hashString } from '../core/rng'
import type { GameContext, Vec3 } from '../core/types'
import type { Pose } from './anim'
import { DRAWINGS, GlassDrawing, REPLIES } from './draw'
import { faceDir } from './places'
import { EXCHANGES, PROMPTS, RITOURNELLES, VITRE, type Exchange, type Line } from './text'
import type { CamilleUi } from './ui'

export interface VitreHost {
  stand(at: Vec3, yaw: number, pose: Pose): void
  pose(p: Pose): void
  leave(): void
  talk(lines: readonly Line[]): Promise<void>
  flag(id: string): boolean
  setFlag(id: string): void
  blocked(): boolean
}

type Phase = 'attend' | 'souffle' | 'dessine' | 'repond' | 'choisit' | 'reaction' | 'depart'

interface Rdv {
  windowId: string
  glass: Vec3
  n: Vec3
  ex: Exchange
  phase: Phase
  t: number
  hers: GlassDrawing
  his: GlassDrawing
}

const PER_DAY = 2
const SCAN_S = 0.3

export class Vitre {
  private rdv: Rdv | null = null
  private scan = 0
  private readonly fading: { d: GlassDrawing; t: number }[] = []
  private prompted = false
  private armed = 0
  private readonly seen = new Set<string>()
  private day = -1
  private today = 0

  constructor(
    private readonly ctx: GameContext,
    private readonly ui: CamilleUi,
    private readonly parent: THREE.Object3D,
    private readonly host: VitreHost,
  ) {
    ctx.bus.on('scrub:done', ({ windowId }) => {
      if (this.rdv?.windowId === windowId && this.rdv.phase === 'attend') this.begin()
    })
  }

  active(): boolean {
    return this.rdv !== null
  }

  done(id: string): boolean {
    return this.host.flag(`vitre:${id}`)
  }

  count(): number {
    return EXCHANGES.filter((e) => this.done(e.id)).length
  }

  update(dt: number, heroLocal: Vec3): void {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]!
      f.t += dt
      f.d.setOpacity(Math.max(0, 1 - f.t / 25))
      if (f.t > 25) {
        f.d.dispose()
        this.fading.splice(i, 1)
      }
    }
    const r = this.rdv
    if (!r) {
      this.scan -= dt
      if (this.scan <= 0) {
        this.scan = SCAN_S
        this.look()
      }
      return
    }
    r.t += dt
    const far = Math.hypot(heroLocal.x - r.glass.x, heroLocal.z - r.glass.z)
    const st = this.ctx.state
    const outside = st.mode === 'sortie' || st.hero.medium === 'water'
    if ((r.phase === 'attend' || r.phase === 'repond') && (far > 10 || !outside)) {
      if (r.phase === 'repond') this.ui.toast(VITRE.kicker, VITRE.partie)
      this.end(r.phase === 'repond')
      return
    }
    switch (r.phase) {
      case 'attend': {
        const w = this.ctx.services.drift?.nearestWindow(st.hero.position, 4)
        if (w && w.id === r.windowId && w.coat < 0.12 && r.t > 1) this.begin()
        break
      }
      case 'souffle':
        if (r.t > 1.4) this.go('dessine', 'draw', () => r.hers.set(DRAWINGS[r.ex.drawing]))
        break
      case 'dessine':
        r.hers.paint(r.t / 3.6)
        if (r.t > 3.8 && !this.host.blocked()) {
          this.go('repond', 'pockets')
          void this.host.talk([[null, r.ex.intro]])
        }
        break
      case 'repond':
        if (this.host.blocked()) {
          this.armed = 0
          break
        }
        this.armed += dt
        if (this.armed > 30) {
          this.ui.toast(VITRE.kicker, VITRE.partie)
          this.end(true)
          return
        }
        if (!this.prompted) {
          this.ui.showPrompt(PROMPTS.repondre)
          this.prompted = true
        }
        if (far < 4 && this.ctx.input.pressed('interact') && this.armed > 0.3) void this.reply()
        break
      case 'choisit':
        r.his.paint(r.t / 2.6)
        break
      case 'reaction':
        r.his.paint(1)
        if (r.t > 6 && !this.host.blocked()) this.go('depart', 'wave')
        break
      case 'depart':
        if (r.t > 2.2) {
          this.end(true)
          return
        }
        break
    }
  }

  private go(p: Phase, pose: Pose, then?: () => void): void {
    const r = this.rdv
    if (!r) return
    r.phase = p
    r.t = 0
    this.host.pose(pose)
    then?.()
  }

  private begin(): void {
    this.go('souffle', 'breathe-glass')
    this.ctx.services.audio?.sfx('glass-tap')
  }

  private async reply(): Promise<void> {
    const r = this.rdv
    if (!r || r.phase !== 'repond') return
    this.ui.showPrompt(null)
    r.phase = 'choisit'
    r.t = 0
    const hero = this.ctx.services.hero
    hero?.setMode('cutscene')
    const pick = await this.ui.ask(PROMPTS.choisir, r.ex.replies.map((x) => x.label))
    const choice = r.ex.replies[pick] ?? r.ex.replies[0]!
    r.his.set(REPLIES[choice.draw])
    r.t = 0
    await new Promise((res) => window.setTimeout(res, 2700))
    if (this.rdv !== r) return
    r.his.paint(1)
    this.host.pose(choice.mood)
    r.phase = 'reaction'
    r.t = 0
    await this.host.talk([[null, choice.reaction]])
    hero?.setMode(this.ctx.state.hero.medium === 'water' ? 'swim' : 'idle')
    this.host.setFlag(`vitre:${r.ex.id}`)
    if (r.ex.flag) this.host.setFlag(r.ex.flag)
    this.today++
  }

  private end(fade: boolean): void {
    const r = this.rdv
    if (!r) return
    this.ui.showPrompt(null)
    this.prompted = false
    for (const d of [r.hers, r.his]) {
      if (fade) this.fading.push({ d, t: 0 })
      else d.dispose()
    }
    if (r.phase === 'reaction' || r.phase === 'depart') this.ui.toast(VITRE.kicker, VITRE.depart)
    this.rdv = null
    this.scan = 4
    this.host.leave()
  }

  private next(): Exchange {
    const st = this.ctx.state
    const choseVue = st.act >= 2 || st.quests['a1-chose'] === 'done'
    for (const e of EXCHANGES) {
      if (this.done(e.id)) continue
      if ((e.minAct ?? 1) > st.act) continue
      if (e.id === 'chose' && !choseVue) continue
      return e
    }
    return RITOURNELLES[(st.time.day + Math.floor(st.time.hours)) % RITOURNELLES.length]!
  }

  private look(): void {
    const ctx = this.ctx
    const st = ctx.state
    const drift = ctx.services.drift
    if (!drift || this.host.blocked()) return
    if (st.mode !== 'sortie' && st.hero.medium !== 'water') return
    const h = st.time.hours
    if (h < 6 || h >= 21.5) return
    if (st.time.day !== this.day) {
      this.day = st.time.day
      this.today = 0
      this.seen.clear()
    }
    if (this.today >= PER_DAY) return
    const w = drift.nearestWindow(st.hero.position, 6)
    if (!w || this.seen.has(w.id)) return
    const first = !this.done(EXCHANGES[0]!.id)
    if (!first && hashString(`${w.id}:${st.time.day}`) % 3 !== 0) return
    this.seen.add(w.id)

    const stand = { x: w.position.x - w.normal.x * 0.75, y: w.position.y, z: w.position.z - w.normal.z * 0.75 }
    if (drift.mediumAt(stand) !== 'air') return
    const hit = ctx.physics.raycast(stand, { x: 0, y: -1, z: 0 }, 3, { excludeKinds: ['glass', 'window', 'trigger', 'fauna'] })
    if (!hit || w.position.y - hit.point.y < 0.5 || w.position.y - hit.point.y > 2.4) return

    const local = drift.toLocal({ x: stand.x, y: hit.point.y, z: stand.z })
    const g = drift.toLocal(w.position)
    g.y = local.y + 1.4
    const tip = drift.toLocal({ x: w.position.x + w.normal.x, y: w.position.y, z: w.position.z + w.normal.z })
    const n = new THREE.Vector3(tip.x - g.x, 0, tip.z - g.z).normalize()
    const right = new THREE.Vector3(-n.z, 0, n.x)

    const ex = this.next()
    const hers = new GlassDrawing('buee', 0.75)
    const his = new GlassDrawing('plancton', 0.65)
    const yaw = Math.atan2(n.x, n.z)
    hers.mesh.position.set(g.x - n.x * 0.17 - right.x * 0.22, g.y + 0.05, g.z - n.z * 0.17 - right.z * 0.22)
    his.mesh.position.set(g.x - n.x * 0.07 - right.x * 0.05, g.y - 0.4, g.z - n.z * 0.07 - right.z * 0.05)
    local.x += right.x * 0.35
    local.z += right.z * 0.35
    hers.mesh.rotation.y = yaw
    his.mesh.rotation.y = yaw
    this.parent.add(hers.mesh, his.mesh)

    this.rdv = { windowId: w.id, glass: g, n: { x: n.x, y: 0, z: n.z }, ex, phase: 'attend', t: 0, hers, his }
    this.host.stand(local, faceDir(n.x, n.z), 'pockets')
    this.ui.toast(VITRE.kicker, VITRE.arrive)
    if (w.coat < 0.12) this.begin()
  }

  dispose(): void {
    if (this.rdv) {
      this.rdv.hers.dispose()
      this.rdv.his.dispose()
      this.rdv = null
    }
    for (const f of this.fading.splice(0)) f.d.dispose()
  }
}
