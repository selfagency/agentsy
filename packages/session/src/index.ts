// @agentsy/session — Session persistence, serialization, and branching
// Initial API scaffold. For broader roadmap context, see plan/MASTER-IMPLEMENTATION-PLAN.md.

import { createHash } from 'node:crypto';

export interface ReusableSessionSegment {
  fingerprint: string;
  invalidations: string[];
  reuseClass: 'hot' | 'warm' | 'cold';
}

export interface SessionState {
  id: string;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
  values: Record<string, unknown>;
}

export interface SessionSnapshot {
  checksum: string;
  schemaVersion: number;
  sessionId: string;
  state: SessionState;
  timestamp: Date;
}

export interface CreateSessionSnapshotInput {
  id: string;
  modelFamily?: string;
  reusableSegments?: ReusableSessionSegment[];
  values: Record<string, unknown>;
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

export interface SessionStore {
  getState(): SessionState;
  getValue(key: string): unknown;
  setValue(key: string, value: unknown): void;
}

export const createSessionStore = (state: SessionState): SessionStore => {
  const values = { ...state.values };

  return {
    getState() {
      return {
        id: state.id,
        values: { ...values }
      };
    },
    getValue(key: string) {
      return values[key];
    },
    setValue(key, value) {
      values[key] = value;
    }
  };
};
