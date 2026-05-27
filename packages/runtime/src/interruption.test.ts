import type { SessionStore } from '@agentsy/session';
import type { RuntimeSnapshot } from '@agentsy/types';
import { describe, expect, it, vi } from 'vitest';

import { createInterruption, resumeFromCheckpoint } from './interruption.js';

describe('createInterruption', () => {
  it('creates a checkpoint with the given reason and snapshot', () => {
    const store: Pick<SessionStore, 'setValue'> = { setValue: vi.fn() };
    const snapshot: RuntimeSnapshot = {
      sessionId: 'sess_1',
      depth: 0,
      completedTaskIds: [],
      results: [],
      childSnapshots: [],
      updatedAt: Date.now()
    };

    const checkpoint = createInterruption('sess_1', 'user interrupted', snapshot, store);

    expect(checkpoint.sessionId).toBe('sess_1');
    expect(checkpoint.reason).toBe('user interrupted');
    expect(checkpoint.snapshot).toEqual(snapshot);
    expect(store.setValue).toHaveBeenCalledWith(expect.stringContaining('interruption_checkpoint:'), checkpoint);
  });

  it('includes metadata when provided', () => {
    const store: Pick<SessionStore, 'setValue'> = { setValue: vi.fn() };
    const snapshot: RuntimeSnapshot = {
      sessionId: '',
      depth: 0,
      completedTaskIds: [],
      results: [],
      childSnapshots: [],
      updatedAt: 0
    };

    const checkpoint = createInterruption('sess_1', 'error', snapshot, store, {
      pendingToolCallId: 'call_123'
    });

    expect(checkpoint.metadata).toEqual({ pendingToolCallId: 'call_123' });
  });
});

describe('resumeFromCheckpoint', () => {
  it('returns null when no checkpoint exists', () => {
    const store: Pick<SessionStore, 'getValue'> = { getValue: vi.fn().mockReturnValue(null) };
    const result = resumeFromCheckpoint('chk_123', store);
    expect(result).toBeNull();
  });

  it('returns the checkpoint when found', () => {
    const checkpoint = {
      id: 'chk_123',
      sessionId: 'sess_1',
      reason: 'interrupted',
      timestamp: Date.now(),
      snapshot: {
        sessionId: 'sess_1',
        depth: 0,
        completedTaskIds: [],
        results: [],
        childSnapshots: [],
        updatedAt: Date.now()
      }
    };
    const store: Pick<SessionStore, 'getValue'> = { getValue: vi.fn().mockReturnValue(checkpoint) };

    const result = resumeFromCheckpoint('chk_123', store);
    expect(result).toEqual(checkpoint);
  });

  it('returns null for invalid checkpoint structure', () => {
    const store: Pick<SessionStore, 'getValue'> = {
      getValue: vi.fn().mockReturnValue({ id: 123, sessionId: 'sess_1' })
    };
    const result = resumeFromCheckpoint('chk_bad', store);
    expect(result).toBeNull();
  });
});
