/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionState } from '../state/schema.js';
import { createSessionStore } from '../store.js';
import type { StaleEntry } from './detector.js';
import { restoreSession } from './restorer.js';

describe('restoreSession', () => {
  let store: ReturnType<typeof createSessionStore>;

  beforeEach(() => {
    store = createSessionStore({ id: 'test', values: {} });
  });

  const staleEntry: StaleEntry = {
    sessionId: 'ses-1',
    threadId: 'main',
    reason: 'heartbeat-missed',
    lastSeenAt: Date.now() - 120_000
  };

  it('creates fresh state when forceFresh is true', () => {
    const result = restoreSession(store, staleEntry, undefined, {
      forceFresh: true,
      crashReason: 'test crash'
    });
    expect(result.ok).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state.sessionId).toBe('ses-1');
  });

  it('creates fresh state when no checkpoint or current state exists', () => {
    const result = restoreSession(store, staleEntry);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/fresh/i);
  });

  it('retains existing state when valid and no checkpoint', () => {
    const state = createSessionState('ses-1', 'main');
    store.setValue('session:ses-1', state);
    const result = restoreSession(store, staleEntry, { valid: true, errors: [], warnings: [] });
    expect(result.ok).toBe(true);
    expect(result.restoredFromCheckpoint).toBeUndefined();
  });

  it('falls back to fresh when existing state is invalid', () => {
    store.setValue('session:ses-1', { sessionId: 'ses-1' });
    const result = restoreSession(store, staleEntry, { valid: false, errors: ['missing fields'], warnings: [] });
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/fresh/i);
  });

  it('restores from checkpoint when available', () => {
    const state = createSessionState('ses-1', 'main');
    store.setValue('checkpoint:cp-1', state);
    const entryWithCp: StaleEntry = {
      ...staleEntry,
      lastCheckpointId: 'cp-1'
    };
    const result = restoreSession(store, entryWithCp);
    expect(result.ok).toBe(true);
    expect(result.restoredFromCheckpoint).toBe('cp-1');
    expect(result.summary).toMatch(/Restored from checkpoint/);
  });

  it('falls back to fresh when checkpoint exists but integrity fails', () => {
    const state = createSessionState('ses-1', 'main');
    store.setValue('checkpoint:cp-1', state);
    const entryWithCp: StaleEntry = {
      ...staleEntry,
      lastCheckpointId: 'cp-1'
    };
    const result = restoreSession(store, entryWithCp, { valid: false, errors: ['bad'], warnings: [] });
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/fresh/i);
  });

  it('falls back to fresh when checkpoint key exists but value is missing', () => {
    const entryWithCp: StaleEntry = {
      ...staleEntry,
      lastCheckpointId: 'cp-missing'
    };
    const result = restoreSession(store, entryWithCp);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/fresh/i);
  });

  it('includes crash reason in fresh state meta', () => {
    const result = restoreSession(store, staleEntry, undefined, {
      forceFresh: true,
      crashReason: 'process killed'
    });
    const meta = result.state.meta as Record<string, unknown>;
    const crashMeta = meta.crashMeta as Record<string, unknown>;
    expect(crashMeta.reason).toBe('process killed');
  });
});
