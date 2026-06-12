import { describe, expect, it } from 'vitest';
import { RememberResult } from './result-handle.js';

describe('RememberResult', () => {
  it('creates with session_stored status', () => {
    const r = new RememberResult({ status: 'session_stored', entryId: 'e1', entryType: 'fact', sessionId: 's1' });
    expect(r.status).toBe('session_stored');
    expect(r.entryId).toBe('e1');
    expect(r.entryType).toBe('fact');
    expect(r.sessionId).toBe('s1');
  });

  it('is done immediately when no improve task attached', () => {
    const r = new RememberResult({ status: 'session_stored' });
    expect(r.done).toBe(true);
  });

  it('becomes done when improve resolves', async () => {
    const r = new RememberResult({ status: 'session_stored' });
    r.setImproveTask(Promise.resolve());
    await Promise.resolve();
    expect(r.done).toBe(true);
    expect(r.improveStatus).toBe('completed');
  });

  it('captures improve errors without throwing', async () => {
    const r = new RememberResult({ status: 'session_stored' });
    const err = new Error('improve failed');
    const errPromise = Promise.reject(err);
    errPromise.catch(() => undefined);
    r.setImproveTask(errPromise);
    await Promise.resolve();
    await Promise.resolve();
    expect(r.improveStatus).toBe('errored');
    expect(r.improveError?.message).toBe('improve failed');
  });

  it('wait() blocks until improve completes', async () => {
    const r = new RememberResult({ status: 'session_stored' });
    r.setImproveTask(Promise.resolve());
    await r.wait();
    expect(r.done).toBe(true);
  });

  it('reports errored status', () => {
    const r = new RememberResult({ status: 'errored', error: new Error('store failed') });
    expect(r.status).toBe('errored');
    expect(r.error?.message).toBe('store failed');
  });
});
