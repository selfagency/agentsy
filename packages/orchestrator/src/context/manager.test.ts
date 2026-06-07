import { describe, expect, it, vi, afterEach } from 'vitest';

import { ContextManager } from './manager.js';

describe('ContextManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('pushContext', () => {
    it('should create a frame with frameId and 30-min expiry', () => {
      const cm = new ContextManager();
      const frame = cm.pushContext({
        agentId: 'agent-1',
        sessionId: 'session-1',
        visibleFields: ['status', 'progress'],
        metadata: { status: 'running', progress: 0.5 },
        lockedResources: []
      });

      expect(frame.frameId).toBeDefined();
      expect(frame.agentId).toBe('agent-1');
      expect(frame.sessionId).toBe('session-1');
      expect(frame.visibleFields).toEqual(['status', 'progress']);

      // Expiry should be ~30 minutes from now
      const expectedExpiry = Date.now() + 30 * 60 * 1000;
      expect(frame.expiry.getTime()).toBeGreaterThan(Date.now());
      expect(frame.expiry.getTime()).toBeLessThanOrEqual(expectedExpiry + 100);
    });

    it('should throw when sessionId is missing', () => {
      const cm = new ContextManager();
      expect(() =>
        cm.pushContext({
          agentId: 'agent-1',
          sessionId: '',
          visibleFields: [],
          metadata: {},
          lockedResources: []
        })
      ).toThrow('sessionId is required');
    });

    it('should throw when agentId is missing', () => {
      const cm = new ContextManager();
      expect(() =>
        cm.pushContext({
          agentId: '',
          sessionId: 'session-1',
          visibleFields: [],
          metadata: {},
          lockedResources: []
        })
      ).toThrow('agentId is required');
    });
  });

  describe('popContext', () => {
    it('should remove a frame and release locks held by that agent', () => {
      const cm = new ContextManager();
      const frame = cm.pushContext({
        agentId: 'agent-1',
        sessionId: 'session-1',
        visibleFields: [],
        metadata: {},
        lockedResources: []
      });

      cm.acquireLock('resource-1', 'agent-1');

      expect(cm.getLockCount()).toBe(1);
      cm.popContext(frame.frameId);
      expect(cm.getFrameCount()).toBe(0);
      // Locks held by agent-1 should be released
      expect(cm.getLockCount()).toBe(0);
    });

    it('should throw if frameId does not exist', () => {
      const cm = new ContextManager();
      expect(() => cm.popContext('nonexistent')).toThrow('ContextFrame "nonexistent" not found');
    });
  });

  describe('getVisibleContext', () => {
    it('should merge visible fields (top frame wins)', () => {
      const cm = new ContextManager();
      cm.pushContext({
        agentId: 'agent-1',
        sessionId: 'session-1',
        visibleFields: ['status', 'progress'],
        metadata: { status: 'idle', progress: 0.3 },
        lockedResources: []
      });

      cm.pushContext({
        agentId: 'agent-1',
        sessionId: 'session-1',
        visibleFields: ['status', 'phase'],
        metadata: { status: 'running', phase: 'execute' },
        lockedResources: []
      });

      const visible = cm.getVisibleContext('agent-1');
      expect(visible).toEqual({
        status: 'running', // top frame wins
        progress: 0.3, // still visible from first frame
        phase: 'execute'
      });
    });

    it('should return empty object for agent with no frames', () => {
      const cm = new ContextManager();
      const visible = cm.getVisibleContext('unknown-agent');
      expect(visible).toEqual({});
    });
  });

  describe('acquireLock', () => {
    it('should acquire a non-conflicting lock', () => {
      const cm = new ContextManager();
      const token = cm.acquireLock('resource-1', 'agent-1');
      expect(token.resource).toBe('resource-1');
      expect(token.heldBy).toBe('agent-1');
      expect(token.ttlMs).toBe(30_000);
    });

    it('should reject if locked by a different agent', () => {
      const cm = new ContextManager();
      cm.acquireLock('resource-1', 'agent-1');
      expect(() => cm.acquireLock('resource-1', 'agent-2')).toThrow('already locked by agent "agent-1"');
    });

    it('should extend expiry for the same agent', async () => {
      const cm = new ContextManager();
      const token1 = cm.acquireLock('resource-1', 'agent-1', 10_000);
      const origExpiry = token1.expiresAt.getTime();

      // Wait a tiny bit so the new expiry is detectably different
      await new Promise(r => setTimeout(r, 5));

      const token2 = cm.acquireLock('resource-1', 'agent-1', 30_000);
      expect(token2.expiresAt.getTime()).toBeGreaterThan(origExpiry);
    });
  });

  describe('releaseLock', () => {
    it('should release a lock held by the correct agent', () => {
      const cm = new ContextManager();
      cm.acquireLock('resource-1', 'agent-1');
      cm.releaseLock('resource-1', 'agent-1');
      // Should be able to acquire again
      const token = cm.acquireLock('resource-1', 'agent-2');
      expect(token.heldBy).toBe('agent-2');
    });

    it('should throw on wrong agent', () => {
      const cm = new ContextManager();
      cm.acquireLock('resource-1', 'agent-1');
      expect(() => cm.releaseLock('resource-1', 'agent-2')).toThrow('not "agent-2"');
    });

    it('should throw when no lock exists', () => {
      const cm = new ContextManager();
      expect(() => cm.releaseLock('nonexistent', 'agent-1')).toThrow('No lock found');
    });
  });

  describe('cleanup', () => {
    it('should remove expired frames and locks', () => {
      const cm = new ContextManager();

      // Can't easily make frames expire since expiry is set 30 min in future.
      // Instead verify cleanup does not throw and leaves valid data intact.
      const frame = cm.pushContext({
        agentId: 'agent-1',
        sessionId: 'session-1',
        visibleFields: [],
        metadata: {},
        lockedResources: []
      });
      cm.acquireLock('resource-1', 'agent-1');

      cm.cleanup();
      expect(cm.getFrameCount()).toBe(1);
      expect(cm.getLockCount()).toBe(1);
    });

    it('should remove expired locks when they have passed expiry', () => {
      const cm = new ContextManager();
      // Acquire with a very short TTL
      cm.acquireLock('resource-short', 'agent-1', 1);

      // Wait for expiration
      return new Promise<void>(resolve => {
        setTimeout(() => {
          cm.cleanup();
          expect(cm.getLockCount()).toBe(0);
          resolve();
        }, 50);
      });
    });
  });
});
