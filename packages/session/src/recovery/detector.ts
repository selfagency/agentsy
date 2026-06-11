/**
 * Stale session detector — scans session stores for entries without recent
 * heartbeat activity and returns them as candidates for recovery.
 *
 * @module
 */

import type { SessionStore } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A session entry flagged by the detector as stale or unreachable. */
export interface StaleEntry {
  /** Last known checkpoint id, if any. */
  lastCheckpointId?: string;
  /** Millisecond timestamp of the last heartbeat or state write. */
  lastSeenAt: number;
  /**
   * Reason the session was flagged:
   *  - `heartbeat-missed` — no heartbeat written within `maxAgeMs`
   *  - `invalid-state` — stored state failed schema validation
   *  - `orphaned-checkpoint` — checkpoint references a non-existent session
   */
  reason: 'heartbeat-missed' | 'invalid-state' | 'orphaned-checkpoint';
  /** Session identifier. */
  sessionId: string;
  /** Thread identifier scoped within the session. */
  threadId: string;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * Scan a session store for stale entries.
 *
 * @param store - The `SessionStore` to scan.
 * @param maxAgeMs - Sessions whose state was last written longer ago than
 *                   this threshold are flagged as stale.
 * @returns A list of `StaleEntry` descriptors.
 */
export function detectStaleSessions(store: SessionStore, maxAgeMs: number): StaleEntry[] {
  const now = Date.now();
  const stale: StaleEntry[] = [];

  for (const key of store.listKeys()) {
    // Session heartbeats are stored under `hb:<sessionId>`
    if (!key.startsWith('hb:')) {
      continue;
    }

    const sessionId = key.slice(3);
    const raw = store.getValue<string>(key);
    if (!raw) {
      // Entry exists but value is null/undefined — treat as invalid
      stale.push(makeDetectorEntry(sessionId, 'invalid-state', now));
      continue;
    }

    let heartbeatTs: number;
    try {
      heartbeatTs = Number(raw);
      if (Number.isNaN(heartbeatTs)) {
        stale.push(makeDetectorEntry(sessionId, 'invalid-state', now));
        continue;
      }
    } catch {
      stale.push(makeDetectorEntry(sessionId, 'invalid-state', now));
      continue;
    }

    if (now - heartbeatTs > maxAgeMs) {
      // Pull the last checkpoint for context
      const stateRaw = store.getValue<Record<string, unknown>>(`session:${sessionId}`);
      const threadId =
        stateRaw && typeof stateRaw === 'object'
          ? String((stateRaw as Record<string, unknown>).threadId ?? 'main')
          : 'main';
      stale.push({
        sessionId,
        threadId,
        reason: 'heartbeat-missed',
        lastSeenAt: heartbeatTs,
        lastCheckpointId: tryReadCheckpointId(store, sessionId)
      });
    }
  }

  return stale;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetectorEntry(sessionId: string, reason: StaleEntry['reason'], now: number): StaleEntry {
  return {
    sessionId,
    threadId: 'main',
    reason,
    lastSeenAt: now
  };
}

function tryReadCheckpointId(store: SessionStore, sessionId: string): string | undefined {
  const keys = store.listKeys();
  const checkpointKeys = keys.filter(
    k => k.startsWith('checkpoint:') && store.getValue<Record<string, unknown>>(k)?.sessionId === sessionId
  );
  return checkpointKeys.length > 0 ? checkpointKeys[0]?.split(':')[1] : undefined;
}
