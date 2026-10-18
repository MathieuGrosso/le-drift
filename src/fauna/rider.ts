import type { GameContext, HeroMode, Vec3 } from '../core/types'

export type Mount = 'manta' | 'baleine'

export function yawOf(dx: number, dz: number): number {
  return Math.atan2(dx, -dz)
}

/** Holds the hero on a creature: mode 'ride' plus a teleport to the seat every lateUpdate. */
export class Rider {
  mount: Mount | null = null
  private hintId: string | null = null
  private cooldown = 0

  constructor(private readonly ctx: GameContext) {}

  get canMount(): boolean {
    return this.mount === null && this.cooldown <= 0 && this.ctx.state.hero.medium === 'water'
  }

  begin(m: Mount): boolean {
    if (!this.canMount) return false
    this.mount = m
    this.setMode('ride')
    return true
  }

  end(): void {
    if (!this.mount) return
    this.mount = null
    this.cooldown = 1
    this.setMode('swim')
  }

  place(seat: Vec3, yaw: number): void {
    if (!this.mount) return
    const hero = this.ctx.services.hero
    if (hero) hero.teleport(seat, yaw)
    else {
      const p = this.ctx.state.hero.position
      p.x = seat.x; p.y = seat.y; p.z = seat.z
      this.ctx.state.hero.yaw = yaw
    }
  }

  hint(id: string, label: string): void {
    if (this.hintId === `${id}:${label}`) return
    this.hintId = `${id}:${label}`
    this.ctx.bus.emit('interact:hint', { id, label })
  }

  clearHint(id: string): void {
    if (!this.hintId?.startsWith(`${id}:`)) return
    this.hintId = null
    this.ctx.bus.emit('interact:hint', null)
  }

  tick(dt: number): void {
    this.cooldown -= dt
  }

  private setMode(m: HeroMode): void {
    const hero = this.ctx.services.hero
    if (hero) hero.setMode(m)
    else this.ctx.state.hero.mode = m
  }
}
