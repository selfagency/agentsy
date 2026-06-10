import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApprovalManager } from './approval-manager.js';

describe('ApprovalManager', () => {
  let manager: ApprovalManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ApprovalManager({ approvalTimeout: 5000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestApproval', () => {
    it('returns a promise that resolves when approved', async () => {
      const promise = manager.requestApproval('fs-write', { path: '/safe' });
      manager.resolve('fs-write', true);
      await expect(promise).resolves.toBe(true);
    });

    it('returns a promise that resolves when denied', async () => {
      const promise = manager.requestApproval('fs-write', { path: '/bad' });
      manager.resolve('fs-write', false);
      await expect(promise).resolves.toBe(false);
    });

    it('auto-denies after timeout', async () => {
      const promise = manager.requestApproval('fs-write', {});
      vi.advanceTimersByTime(5000);
      await expect(promise).resolves.toBe(false);
    });

    it('supports multiple concurrent pending requests', () => {
      const p1 = manager.requestApproval('tool-a', {});
      const p2 = manager.requestApproval('tool-b', {});
      expect(manager.pendingCount).toBe(2);
      expect(manager.listPending()).toHaveLength(2);
      // Clean up — resolve both to avoid unhandled rejections
      manager.resolve('tool-a', true);
      manager.resolve('tool-b', true);
    });
  });

  describe('resolve', () => {
    it('resolves by tool name (first match)', async () => {
      const promise = manager.requestApproval('fs-write', { path: '/a' });
      const resolved = manager.resolve('fs-write', true);
      expect(resolved).toBe(true);
      await expect(promise).resolves.toBe(true);
    });

    it('returns false for unknown tool name', () => {
      expect(manager.resolve('nonexistent', true)).toBe(false);
    });

    it('resolves only the first pending match', async () => {
      const p1 = manager.requestApproval('fs-write', { path: '/a' });
      const p2 = manager.requestApproval('fs-write', { path: '/b' });

      expect(manager.pendingCount).toBe(2);
      manager.resolve('fs-write', true);
      expect(manager.pendingCount).toBe(1);

      await expect(p1).resolves.toBe(true);
      // Clean up remaining
      manager.resolve('fs-write', true);
      await expect(p2).resolves.toBe(true);
    });
  });

  describe('rejectAll', () => {
    it('rejects all pending approvals', async () => {
      const p1 = manager.requestApproval('tool-a', {});
      const p2 = manager.requestApproval('tool-b', {});
      manager.rejectAll();
      await expect(p1).resolves.toBe(false);
      await expect(p2).resolves.toBe(false);
      expect(manager.pendingCount).toBe(0);
    });

    it('is a no-op when no pending approvals exist', () => {
      expect(() => manager.rejectAll()).not.toThrow();
    });
  });

  describe('listPending', () => {
    it('returns a snapshot of pending requests', () => {
      manager.requestApproval('tool-a', {});
      manager.requestApproval('tool-b', { key: 'val' });
      const pending = manager.listPending();
      expect(pending).toHaveLength(2);
      expect(pending[0]?.toolName).toBe('tool-a');
      expect(pending[1]?.toolName).toBe('tool-b');
      expect(pending[1]?.args).toEqual({ key: 'val' });

      // Clean up
      manager.rejectAll();
    });

    it('returns a snapshot (not a live reference)', () => {
      manager.requestApproval('tool-a', {});
      const snapshot = manager.listPending();
      expect(snapshot).toHaveLength(1);
      // Clearing the snapshot should not affect the manager
      manager.rejectAll();
      expect(manager.pendingCount).toBe(0);
    });
  });

  describe('pendingCount', () => {
    it('starts at 0', () => {
      expect(manager.pendingCount).toBe(0);
    });

    it('increments on requestApproval and decrements on resolve', () => {
      manager.requestApproval('tool-a', {});
      expect(manager.pendingCount).toBe(1);
      manager.resolve('tool-a', true);
      expect(manager.pendingCount).toBe(0);
    });
  });
});
