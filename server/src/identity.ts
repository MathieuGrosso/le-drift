import { createHash, timingSafeEqual } from 'node:crypto'
import type { JoinOptions } from '../../src/shared/protocol'
import type { PlayerRecord, Store } from './persist'

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex')

/** First join claims the id; later joins must present the same secret. */
export async function authenticate(store: Store, opts: JoinOptions): Promise<PlayerRecord | null> {
  await store.loadPlayer(opts.identity.id)
  // Re-read after the await: a concurrent join of the same id may have claimed it meanwhile.
  const known = store.player(opts.identity.id)
  const now = Date.now()
  const h = hash(opts.identity.secret)
  if (known) {
    if (!timingSafeEqual(Buffer.from(known.secretHash), Buffer.from(h))) return null
    const rec = { ...known, profile: opts.profile, seenAt: now }
    store.putPlayer(rec)
    return rec
  }
  const rec: PlayerRecord = { id: opts.identity.id, secretHash: h, profile: opts.profile, save: null, createdAt: now, seenAt: now }
  store.putPlayer(rec)
  return rec
}
