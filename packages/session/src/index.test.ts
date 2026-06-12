import { describe, expect, it } from 'vitest';

import { createSessionStore } from './index.js';

describe('createSessionStore', () => {
  it('stores values and returns session state', () => {
    const store = createSessionStore({ id: 's1', values: {} });
    store.setValue('topic', 'agents');

    expect(store.getState()).toEqual({
      id: 's1',
      values: { topic: 'agents' }
    });
  });

  it('returns typed values when requested', () => {
    const store = createSessionStore({
      id: 's1',
      values: { enabled: true, retries: 2 }
    });

    expect(store.getValue('retries')).toBe(2);
    expect(store.getValue('enabled')).toBeTruthy();
    expect(store.getValue('missing')).toBeUndefined();
  });

  it('returns defensive copies from getState', () => {
    const store = createSessionStore({ id: 's1', values: { a: 1 } });
    const state = store.getState();
    state.id = 'changed';
    state.values.a = 2;

    expect(store.getState().id).toBe('s1');
    expect(store.getState().values.a).toBe(1);
  });
});
