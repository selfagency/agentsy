import { beforeEach, describe, expect, it } from 'vitest';

import { createPersonaStore, type PersonaStore } from './persona-store.js';

describe('PersonaStore', () => {
  let store: PersonaStore;

  beforeEach(() => {
    store = createPersonaStore();
  });

  it('returns undefined for unknown user', () => {
    expect(store.get('unknown')).toBeUndefined();
  });

  it('creates default persona on first update', () => {
    const updated = store.update('user-1', {
      attributes: [
        {
          key: 'role',
          value: 'developer',
          confidence: 0.9,
          sourceIds: ['mem-1'],
          updatedAt: 10_000
        }
      ]
    });
    expect(updated.userId).toBe('user-1');
    expect(updated.attributes.length).toBe(1);
    expect(updated.attributes[0]?.key).toBe('role');
    expect(updated.communicationStyle.verbosity).toBe('moderate');
    expect(updated.communicationStyle.prefersExamples).toBe(true);
  });

  it('merges attributes on update', () => {
    store.update('user-1', {
      attributes: [
        {
          key: 'role',
          value: 'developer',
          confidence: 0.8,
          sourceIds: ['mem-1'],
          updatedAt: 10_000
        }
      ]
    });
    const updated = store.update('user-1', {
      attributes: [
        {
          key: 'role',
          value: 'senior developer',
          confidence: 0.9,
          sourceIds: ['mem-2'],
          updatedAt: 20_000
        },
        {
          key: 'team',
          value: 'platform',
          confidence: 0.7,
          sourceIds: ['mem-3'],
          updatedAt: 20_000
        }
      ]
    });
    expect(updated.attributes.length).toBe(2);
    const roleAttr = updated.attributes.find(a => a.key === 'role');
    expect(roleAttr?.value).toBe('senior developer');
    expect(roleAttr?.confidence).toBe(0.9);
    expect(roleAttr?.sourceIds).toContain('mem-1');
    expect(roleAttr?.sourceIds).toContain('mem-2');
  });

  it('merges preferences on update', () => {
    store.update('user-1', { preferences: { theme: 'dark' } });
    const updated = store.update('user-1', { preferences: { fontSize: 14 } });
    expect(updated.preferences.theme).toBe('dark');
    expect(updated.preferences.fontSize).toBe(14);
  });

  it('merges communication style', () => {
    store.update('user-1', {
      communicationStyle: { tone: 'casual', verbosity: 'moderate', prefersExamples: true }
    });
    const updated = store.update('user-1', {
      communicationStyle: { verbosity: 'concise' }
    });
    expect(updated.communicationStyle.tone).toBe('casual');
    expect(updated.communicationStyle.verbosity).toBe('concise');
  });

  it('updates updatedAt timestamp', () => {
    const before = performance.now();
    const updated = store.update('user-1', { preferences: { theme: 'dark' } });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('lists attributes sorted by confidence', () => {
    store.update('user-1', {
      attributes: [
        { key: 'role', value: 'dev', confidence: 0.5, sourceIds: [], updatedAt: 0 },
        { key: 'skill', value: 'TS', confidence: 0.9, sourceIds: [], updatedAt: 0 }
      ]
    });
    const attrs = store.listAttributes('user-1');
    expect(attrs[0]?.key).toBe('skill');
    expect(attrs[1]?.key).toBe('role');
  });

  it('returns empty attributes for unknown user', () => {
    expect(store.listAttributes('unknown')).toEqual([]);
  });

  it('lists user IDs', () => {
    store.update('user-a', {});
    store.update('user-b', {});
    const ids = store.listUserIds();
    expect(ids.length).toBe(2);
    expect(ids).toContain('user-a');
    expect(ids).toContain('user-b');
  });

  it('deletes a persona', () => {
    store.update('user-1', {});
    expect(store.delete('user-1')).toBe(true);
    expect(store.get('user-1')).toBeUndefined();
    expect(store.delete('user-1')).toBe(false);
  });
});
