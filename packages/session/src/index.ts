// @agentsy/session — Session persistence, serialization, and branching
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

import { createHash } from 'node:crypto';

export interface ReusableSessionSegment {
  fingerprint: string;
  reuseClass: 'hot' | 'warm' | 'cold';
  invalidations: string[];
}

export interface SessionState {
  id: string;
  values: Record<string, unknown>;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
}

export interface SessionSnapshot {
  sessionId: string;
  timestamp: Date;
  checksum: string;
  state: SessionState;
  schemaVersion: number;
}

export interface CreateSessionSnapshotInput {
  id: string;
  values: Record<string, unknown>;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
}

export function createSessionSnapshot(input: CreateSessionSnapshotInput): SessionSnapshot {
  const inferredModelFamily =
    input.modelFamily ?? (typeof input.values.modelFamily === 'string' ? input.values.modelFamily : undefined);
  const snapshotState: SessionState = {
    id: input.id,
    values: { ...input.values },
    ...(inferredModelFamily === undefined ? {} : { modelFamily: inferredModelFamily }),
    ...(input.reusableSegments === undefined
      ? {}
      : {
          reusableSegments: input.reusableSegments.map(segment => ({
            fingerprint: segment.fingerprint,
            reuseClass: segment.reuseClass,
            invalidations: [...segment.invalidations],
          })),
        }),
  };

  const checksumSource = JSON.stringify({
    id: snapshotState.id,
    values: snapshotState.values,
    modelFamily: snapshotState.modelFamily ?? null,
    reusableSegments: snapshotState.reusableSegments ?? null,
  });

  return {
    sessionId: input.id,
    timestamp: new Date(),
    checksum: `sha256:${createHash('sha256').update(checksumSource).digest('hex')}`,
    state: snapshotState,
    schemaVersion: 1,
  };
}

export interface SessionStore {
  getState(): SessionState;
  getValue<T = unknown>(key: string): T | undefined;
  setValue(key: string, value: unknown): void;
}

export const createSessionStore = (state: SessionState): SessionStore => {
  const values = { ...state.values };

  return {
    getState() {
      return {
        id: state.id,
        values: { ...values },
      };
    },
    getValue<T = unknown>(key: string) {
      return values[key] as T | undefined;
    },
    setValue(key, value) {
      values[key] = value;
    },
  };
};
