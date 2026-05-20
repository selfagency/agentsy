import { describe, expect, it } from 'vitest';

import { createSecretStore } from './index.js';

describe('createSecretStore', () => {
  it('sets and gets secrets', () => {
    const store = createSecretStore();
    store.setSecret('token', 'abc123');

    expect(store.getSecret('token')).toBe('abc123');
  });

  it('deletes secrets', () => {
    const store = createSecretStore();
    store.setSecret('token', 'abc123');

    expect(store.deleteSecret('token')).toBeTruthy();
    expect(store.getSecret('token')).toBeUndefined();
  });
});
