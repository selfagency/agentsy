// on-session-end.ts — Lifecycle hook: agent session end
// Ingests remainder of session events, runs final consolidation

import type { PendingEvent } from '../cognitive/awaken.js';
import type { MemoryEngine } from '../cognitive/memory-engine.js';

export interface OnSessionEndInput {
  engine: MemoryEngine;
  sessionEvents?: PendingEvent[];
  persist?: boolean;
}

export interface OnSessionEndOutput {
  consolidated: number;
  persisted: number;
  durationMs: number;
}

/**
 * Called when an agent session ends.
 * - Ingests remaining session events
 * - Runs final consolidation pass via awaken()
 * - Returns summary for agent logging
 */
export async function onSessionEnd(input: OnSessionEndInput): Promise<OnSessionEndOutput> {
  const start = performance.now();
  const { engine, sessionEvents, persist: _persist } = input;

  let persisted = 0;

  // Ingest remaining session events
  if (sessionEvents && sessionEvents.length > 0) {
    for (const event of sessionEvents) {
      const opts: Record<string, unknown> = {};
      if (event.importance !== undefined) opts.importance = event.importance;
      if (event.metadata !== undefined) opts.metadata = event.metadata;
      // NOSONAR: cast is required to pass generic opts to engine.ingest()
      const id = engine.ingest(event.content, opts as Parameters<typeof engine.ingest>[1]);
      if (id !== null) {
        persisted++;
      }
    }
  }

  // Run final consolidation
  const result = await engine.awaken();

  const consolidated =
    result.consolidation.compressed + result.consolidation.synthesized + result.consolidation.summarized;

  const durationMs = performance.now() - start;

  return { consolidated, persisted, durationMs };
}
