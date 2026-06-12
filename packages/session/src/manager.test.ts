import { describe, expect, it } from 'vitest';
import { createSessionManager } from './manager.js';
import { createSessionStore } from './store.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createStore() {
  return createSessionStore({
    id: 'test-session',
    values: {}
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager', () => {
  describe('creation', () => {
    it('creates a manager with default session id', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      const state = mgr.getState();
      expect(state.sessionId).toBeTypeOf('string');
      expect(state.messages).toEqual([]);
    });

    it('accepts custom session options', () => {
      const store = createStore();
      const mgr = createSessionManager(store, {
        sessionId: 'custom-ses',
        threadId: 'custom-thread'
      });
      const state = mgr.getState();
      expect(state.sessionId).toBe('custom-ses');
      expect(state.threadId).toBe('custom-thread');
    });

    it('restores state from the store', () => {
      const store = createStore();
      // Pre-populate store
      store.setValue('session_state', {
        sessionId: 'restored',
        threadId: 'restored-t',
        messages: [{ role: 'user', content: 'hello' }],
        toolCallQueue: [],
        checkpoints: [],
        createdAt: 100,
        updatedAt: 100,
        meta: {}
      });
      const mgr = createSessionManager(store);
      expect(mgr.getState().sessionId).toBe('restored');
      expect(mgr.getState().messages).toHaveLength(1);
    });

    it('returns null for an invalid stored state', () => {
      const store = createStore();
      store.setValue('session_state', { invalid: true });
      const mgr = createSessionManager(store);
      // Falls back to a fresh state
      expect(mgr.getState().messages).toEqual([]);
      expect(mgr.getState().sessionId).toBeTypeOf('string');
    });
  });

  describe('apply', () => {
    it('appends a message', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.apply({
        type: 'appendMessage',
        message: { role: 'user', content: 'hi' }
      });
      expect(mgr.getState().messages).toHaveLength(1);
      expect(mgr.getState().messages[0]?.content).toBe('hi');
    });

    it('persists the new state to the store', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.apply({
        type: 'setMeta',
        key: 'model',
        value: 'gpt-4'
      });
      const raw = store.getValue('session_state') as Record<string, unknown>;
      expect((raw.meta as Record<string, string>).model).toBe('gpt-4');
    });
  });

  describe('fork', () => {
    it('creates a child manager with parent reference', () => {
      const store = createStore();
      const mgr = createSessionManager(store, { sessionId: 'parent' });
      mgr.apply({
        type: 'appendMessage',
        message: { role: 'user', content: 'parent msg' }
      });

      const child = mgr.fork();
      const childState = child.getState();
      expect(childState.parentSessionId).toBe('parent');
      expect(childState.sessionId).not.toBe('parent');
      // Child inherits messages
      expect(childState.messages).toHaveLength(1);
    });

    it('uses a separate store when provided', () => {
      const parentStore = createStore();
      const childStore = createStore();
      const mgr = createSessionManager(parentStore);
      mgr.apply({
        type: 'appendMessage',
        message: { role: 'user', content: 'only parent' }
      });

      const _child = mgr.fork(() => childStore);
      // Child store has forked state
      const childState = childStore.getValue('session_state') as Record<string, unknown>;
      expect(childState.messages as unknown[]).toHaveLength(1);
      // Parent store unchanged by fork
      expect(parentStore.getValue('session_state')).toBeDefined();
    });
  });

  describe('checkpoints', () => {
    it('save and load a checkpoint', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.apply({
        type: 'appendMessage',
        message: { role: 'user', content: 'msg 1' }
      });
      const cpId = mgr.saveCheckpoint('after-msg1');
      expect(cpId).toMatch(/^cp_\d+_\d+$/);

      const loaded = mgr.loadCheckpoint(cpId);
      expect(loaded).not.toBeNull();
      expect(loaded?.messages).toHaveLength(1);
      expect(loaded?.messages[0]?.content).toBe('msg 1');
    });

    it('lists saved checkpoints', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.saveCheckpoint('first');
      mgr.saveCheckpoint('second');
      const list = mgr.getCheckpoints();
      expect(list).toHaveLength(2);
      expect(list[0]?.label).toBe('first');
      expect(list[1]?.label).toBe('second');
    });

    it('clears a checkpoint', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      const cpId = mgr.saveCheckpoint('temp');
      expect(mgr.getCheckpoints()).toHaveLength(1);
      mgr.clearCheckpoint(cpId);
      expect(mgr.getCheckpoints()).toHaveLength(0);
      expect(mgr.loadCheckpoint(cpId)).toBeNull();
    });

    it('returns null for unknown checkpoint id', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      expect(mgr.loadCheckpoint('nonexistent')).toBeNull();
    });

    it('restoreCheckpoint rolls back state', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.apply({ type: 'appendMessage', message: { role: 'user', content: 'a' } });
      const cpId = mgr.saveCheckpoint('after-a');
      mgr.apply({ type: 'appendMessage', message: { role: 'user', content: 'b' } });
      expect(mgr.getState().messages).toHaveLength(2);

      const restored = mgr.restoreCheckpoint(cpId);
      expect(restored.getState().messages).toHaveLength(1);
      expect(restored.getState().messages[0]?.content).toBe('a');
    });
  });

  describe('persist', () => {
    it('persists current state to store', () => {
      const store = createStore();
      const mgr = createSessionManager(store);
      mgr.apply({ type: 'setMeta', key: 'foo', value: 'bar' });
      mgr.persist();
      const raw = store.getValue('session_state') as Record<string, unknown>;
      expect((raw.meta as Record<string, string>).foo).toBe('bar');
    });
  });
});
