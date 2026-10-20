import { CONFIG } from '../config'
import { jsonPersistence } from './json'
import type { PersistencePort } from './port'

export type { MemoryEvent, NpcMemory, PersistencePort, PlayerRecord, Store, WorldRecord } from './port'
export { openStore } from './store'

/** `DRIFT_STORE` picks the adapter; a new backend is one more case here (docs/SUPABASE.md). */
export function configuredPersistence(): Promise<PersistencePort> {
  switch (CONFIG.store) {
    case 'json':
      return jsonPersistence(CONFIG.dataDir)
  }
}
