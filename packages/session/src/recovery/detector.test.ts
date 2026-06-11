/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include mixed HTML/XML */
import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionStore } from '../store.js';
import { detectStaleSessions } from './detector.js';

describe('detectStaleSessions', () => {
  let store: ReturnType<typeof createSessionStore>;

  beforeEach(() => {
    store = createSessionStore({ id: 'test', values: {} });
  });

  it('returns empty when no heartbeat entries exist', () => {
    store = createSessionStore({ id: 'test', values: {} });
    // Key without hb: prefix should be ignored
    store.setValue('session:ses-1', { sessionId: 'ses-1', threadId: 'main' });
    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(0);
  });

  it('flags stale sessions beyond maxAgeMs', () => {
    store.setValue('hb:ses-1', String(Date.now() - 120_000));
    store.setValue('session:ses-1', { sessionId: 'ses-1', threadId: 'main' } as unknown as Record<string, unknown>);

    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(1);
    expect(result[0]?.sessionId).toBe('ses-1');
    expect(result[0]?.reason).toBe('heartbeat-missed');
  });

  it('skips recent heartbeat entries', () => {
    store.setValue('hb:ses-1', String(Date.now() - 5000));
    store.setValue('session:ses-1', { sessionId: 'ses-1' } as unknown as Record<string, unknown>);
    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(0);
  });

  it('flags entries with unparseable heartbeat values as invalid-state', () => {
    store.setValue('hb:ses-1', 'not-a-number');
    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe('invalid-state');
  });

  it('flags entries with missing heartbeat value as invalid-state', () => {
    // Simulate missing value by not setting hb entry — only session data exists
    store.setValue('hb:ses-2', ''); // empty string won't parse as number
    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(1);
  });

  it('does not flag keys without hb: prefix', () => {
    store.setValue('other:key', String(Date.now() - 120_000));
    const result = detectStaleSessions(store, 60_000);
    expect(result).toHaveLength(0);
  });
});
