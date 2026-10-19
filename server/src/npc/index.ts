import type { NpcBrains } from './brain'

/** Scripted mode: no orders are issued and clients keep their local routines and CHATTER lines. */
export function createScriptedBrains(): NpcBrains {
  return { enabled: false, think: async () => [], dispose: () => undefined }
}
