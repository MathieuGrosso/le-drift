import type { PlayerCardView, PlayerId, Profile } from '../../../src/shared/protocol'
import type { DistrictId } from '../../../src/core/types'

export interface MondePort {
  updateCard(id: PlayerId, patch: Partial<Pick<PlayerCardView, 'district' | 'status'>>): void
  /** A district session needs a live monde session of the same player. */
  online(id: PlayerId): boolean
}

export interface QuartierPort {
  updateProfile(id: PlayerId, profile: Profile): void
  district(): DistrictId
  hosts(id: PlayerId): boolean
  /** Closes the player's district session: a newer tab took the player over. */
  evict(id: PlayerId): void
}

/** How the rooms reach each other: districts feed the roster, a profile change reaches every avatar. NPCs use `brains.rooms`. */
export interface RoomRegistry {
  attachMonde(port: MondePort): void
  detachMonde(port: MondePort): void
  attachQuartier(port: QuartierPort): void
  detachQuartier(port: QuartierPort): void
  monde(): MondePort | null
  quartiers(): Iterable<QuartierPort>
}

export function createRegistry(): RoomRegistry {
  let monde: MondePort | null = null
  const quartiers = new Set<QuartierPort>()
  return {
    attachMonde: (port) => void (monde = port),
    detachMonde: (port) => void (monde === port && (monde = null)),
    attachQuartier: (port) => void quartiers.add(port),
    detachQuartier: (port) => void quartiers.delete(port),
    monde: () => monde,
    quartiers: () => quartiers,
  }
}
