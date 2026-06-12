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
  lastCheckpointId?: string | undefined;
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
    if (!key.startsWith('hb:')) {
      continue;
    }

    const sessionId = key.slice(3);
    const entry = checkHeartbeat(store, sessionId, now, maxAgeMs);
    if (entry) {
      stale.push(entry);
    }
  }

  return stale;
}

function checkHeartbeat(store: SessionStore, sessionId: string, now: number, maxAgeMs: number): StaleEntry | undefined {
  const raw = store.getValue<string>(`hb:${sessionId}`);
  if (!raw) {
    return makeDetectorEntry(sessionId, 'invalid-state', now);
  }

  let heartbeatTs: number;
  try {
    heartbeatTs = Number(raw);
    if (Number.isNaN(heartbeatTs)) {
      return makeDetectorEntry(sessionId, 'invalid-state', now);
    }
  } catch {
    return makeDetectorEntry(sessionId, 'invalid-state', now);
  }

  if (now - heartbeatTs <= maxAgeMs) {
    return;
  }

  const stateRaw = store.getValue<Record<string, unknown>>(`session:${sessionId}`);
  const threadId =
    stateRaw && typeof stateRaw === 'object' ? ((stateRaw.threadId as string | undefined) ?? 'main') : 'main';

  return {
    sessionId,
    threadId,
    reason: 'heartbeat-missed',
    lastSeenAt: heartbeatTs,
    lastCheckpointId: tryReadCheckpointId(store, sessionId)
  };
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
