import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './index.js';

describe('createMemoryStore', () => {
  it('stores and retrieves records by id', () => {
    const store = createMemoryStore();
    const record = { id: 'r1', content: 'hello' };

    store.put(record);

    expect(store.get('r1')).toEqual(record);
  });

  it('lists all stored records', () => {
    const store = createMemoryStore();
    store.put({ id: 'a', content: 'one' });
    store.put({ id: 'b', content: 'two' });

    expect(store.list()).toHaveLength(2);
  });
});
