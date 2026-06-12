/**
 * Legacy session store and snapshot types.
 *
 * Will be superseded by the typed state layer in {@link ./state/index.ts}
 * as Phase 6 progresses.
 */

import { createHash } from 'node:crypto';

/** A segment of a prior session that can be reused (hot/warm/cold cache classification). */
export interface ReusableSessionSegment {
  fingerprint: string;
  invalidations: string[];
  reuseClass: 'hot' | 'warm' | 'cold';
}

/** Serializable state of an agent session at a point in time (legacy flat format). */
export interface LegacySessionState {
  id: string;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
  values: Record<string, unknown>;
}

/** Checksummed, versioned snapshot of a session for caching and branching. */
export interface SessionSnapshot {
  checksum: string;
  schemaVersion: number;
  sessionId: string;
  state: LegacySessionState;
  timestamp: Date;
}

/** Input parameters for constructing a SessionSnapshot. */
export interface CreateSessionSnapshotInput {
  id: string;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
  values: Record<string, unknown>;
}

export function createSessionSnapshot(input: CreateSessionSnapshotInput): SessionSnapshot {
  const inferredModelFamily =
    input.modelFamily ?? (typeof input.values.modelFamily === 'string' ? input.values.modelFamily : undefined);
  const snapshotState: LegacySessionState = {
    id: input.id,
    values: { ...input.values },
    ...(inferredModelFamily === undefined ? {} : { modelFamily: inferredModelFamily }),
    ...(input.reusableSegments === undefined
      ? {}
      : {
          reusableSegments: input.reusableSegments.map(segment => ({
            fingerprint: segment.fingerprint,
            invalidations: [...segment.invalidations],
            reuseClass: segment.reuseClass
          }))
        })
  };

  const checksumSource = JSON.stringify({
    id: snapshotState.id,
    modelFamily: snapshotState.modelFamily ?? null,
    reusableSegments: snapshotState.reusableSegments ?? null,
    values: snapshotState.values
  });

  return {
    checksum: `sha256:${createHash('sha256').update(checksumSource).digest('hex')}`,
    schemaVersion: 1,
    sessionId: input.id,
    state: snapshotState,
    timestamp: new Date()
  };
}

/** In-memory key-value store for session state with snapshot isolation. */
export interface SessionStore {
  clear(): void;
  getState(): LegacySessionState;
  getValue<T = unknown>(key: string): T | undefined;
  /** Return all stored keys. */
  listKeys(): string[];
  removeValue(key: string): void;
  setValue(key: string, value: unknown): void;
}

export const createSessionStore = (state: LegacySessionState): SessionStore => {
  const values: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(state.values)) {
    if (Object.hasOwn(state.values, key)) {
      values[key] = state.values[key];
    }
  }

  return {
    clear() {
      for (const key of Object.keys(values)) {
        delete values[key];
      }
    },
    getState() {
      const snapshot: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(values)) {
        if (Object.hasOwn(values, key)) {
          snapshot[key] = values[key];
        }
      }
      return {
        id: state.id,
        values: snapshot
      };
    },
    getValue<T>(key: string) {
      if (!Object.hasOwn(values, key)) {
        return;
      }
      return values[key] as T | undefined;
    },
    listKeys() {
      return Object.keys(values);
    },
    removeValue(key: string) {
      if (Object.hasOwn(values, key)) {
        delete values[key];
      }
    },
    setValue(key, value) {
      values[key] = value;
    }
  };
};
