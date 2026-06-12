/**
 * Session recovery — restores a stale or corrupted session from its last known
 * good checkpoint, or creates a clean slate with a crash report entry.
 *
 * @module
 */

import type { SessionState } from '../state/schema.js';
import { createSessionState } from '../state/schema.js';
import type { SessionStore } from '../store.js';
import type { StaleEntry } from './detector.js';
import type { IntegrityResult } from './validator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RestoreResult {
  /** Whether recovery completed without errors. */
  ok: boolean;
  /** Id of the checkpoint used, if any. */
  restoredFromCheckpoint?: string;
  /** The restored (or fresh) session state. */
  state: SessionState;
  /** Human-readable description of what the recovery did. */
  summary: string;
}

export interface RestoreOptions {
  /** Reason for the recovery to record in crashMeta. */
  crashReason?: string;
  /** When true, create a fresh state instead of attempting checkpoint rollback. */
  forceFresh?: boolean;
}

// ---------------------------------------------------------------------------
// Restorer
// ---------------------------------------------------------------------------

/**
 * Attempt to restore a stale session.
 *
 * Recovery strategy:
 *  1. If `forceFresh` is set → create a brand-new state with crash metadata
 *  2. Try to load the last available checkpoint from the store
 *  3. If checkpoint found → hydrate from it
 *  4. Otherwise → create a fresh state
 *
 * @param store - The session store backing the session.
 * @param entry  - The stale entry returned by the detector.
 * @param integrity - Optional integrity result; if the state is corrupt
 *                    the restorer falls back to checkpoint or fresh.
 * @param options   - Recovery options.
 */
export function restoreSession(
  store: SessionStore,
  entry: StaleEntry,
  integrity?: IntegrityResult,
  options?: RestoreOptions
): RestoreResult {
  const sessionId = entry.sessionId;
  const threadId = entry.threadId;

  // 1. Force fresh
  if (options?.forceFresh) {
    const state = createFreshWithCrashMeta(sessionId, threadId, options.crashReason);
    persistState(store, sessionId, state);
    return {
      state,
      summary: `Created fresh session after forced recovery: ${options.crashReason ?? 'unknown'}`,
      ok: true
    };
  }

  // 2. Try checkpoint
  const checkpointId = entry.lastCheckpointId;
  if (checkpointId) {
    const raw = store.getValue<Record<string, unknown>>(`checkpoint:${checkpointId}`);
    if (raw) {
      // Validate checkpoint if integrator is provided
      if (integrity && !integrity.valid) {
        return fallbackToFresh(store, sessionId, threadId, checkpointId, integrity);
      }
      const state = raw as unknown as SessionState;
      persistState(store, sessionId, state);
      return {
        state,
        summary: `Restored from checkpoint "${checkpointId}"`,
        ok: true,
        restoredFromCheckpoint: checkpointId
      };
    }
  }

  // 3. Try current state — keep it only if no integrity issues
  const currentRaw = store.getValue<Record<string, unknown>>(`session:${sessionId}`);
  if (currentRaw && integrity?.valid) {
    const state = currentRaw as unknown as SessionState;
    return {
      state,
      summary: `Session retained existing state (${sessionId})`,
      ok: true
    };
  }

  // 4. Fallback to fresh
  return fallbackToFresh(store, sessionId, threadId, undefined, undefined, options?.crashReason);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createFreshWithCrashMeta(sessionId: string, threadId: string, crashReason?: string): SessionState {
  const state = createSessionState(sessionId, threadId);
  state.meta = {
    ...state.meta,
    crashMeta: {
      recoveredAt: Date.now(),
      reason: crashReason ?? 'unknown'
    }
  };
  return state;
}

function persistState(store: SessionStore, sessionId: string, state: SessionState): void {
  store.setValue(`session:${sessionId}`, state);
}

function fallbackToFresh(
  store: SessionStore,
  sessionId: string,
  threadId: string,
  checkpointId?: string,
  _integrity?: IntegrityResult,
  crashReason?: string
): RestoreResult {
  const state = createFreshWithCrashMeta(sessionId, threadId, crashReason);
  persistState(store, sessionId, state);
  return {
    state,
    summary: `Created fresh session after recovery (checkpoint ${checkpointId ?? 'none'})`,
    ok: true
  };
}
