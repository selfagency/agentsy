import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { type ApprovalGate, createApprovalHook, isDestructiveTool } from './approval-hook.js';
import type { PreToolCallEvent, RuntimeHookEvent } from './types.js';

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function createPreToolCall(overrides: Partial<PreToolCallEvent> = {}): PreToolCallEvent {
  return {
    args: { path: resolve(import.meta.dirname, '__fixtures__', 'test.txt') },
    sessionId: 'sess_test_001',
    toolName: 'read',
    type: 'PreToolCall',
    ...overrides
  };
}

function createNonPreToolCall(): RuntimeHookEvent {
  return {
    estimatedTokens: 100,
    logicalModelId: 'claude-sonnet-4',
    providerId: 'anthropic',
    replicaId: 'rep_01',
    sessionId: 'sess_test_001',
    type: 'PreModelCall'
  } as RuntimeHookEvent;
}

function createMockGate(approve: boolean): ApprovalGate {
  return { requestApproval: vi.fn().mockResolvedValue(approve) };
}

// ---------------------------------------------------------------------------
// isDestructiveTool
// ---------------------------------------------------------------------------

describe('isDestructiveTool', () => {
  it('returns true for known destructive patterns', () => {
    expect(isDestructiveTool('write')).toBe(true);
    expect(isDestructiveTool('delete')).toBe(true);
    expect(isDestructiveTool('remove')).toBe(true);
    expect(isDestructiveTool('destroy')).toBe(true);
    expect(isDestructiveTool('filesystem_delete')).toBe(true);
    expect(isDestructiveTool('db_drop_table')).toBe(true);
    expect(isDestructiveTool('rm')).toBe(true);
    expect(isDestructiveTool('kill')).toBe(true);
  });

  it('returns true regardless of case', () => {
    expect(isDestructiveTool('Write')).toBe(true);
    expect(isDestructiveTool('DELETE')).toBe(true);
    expect(isDestructiveTool('DestroyFile')).toBe(true);
  });

  it('returns false for safe tool names', () => {
    expect(isDestructiveTool('read')).toBe(false);
    expect(isDestructiveTool('list')).toBe(false);
    expect(isDestructiveTool('search')).toBe(false);
    expect(isDestructiveTool('grep')).toBe(false);
    expect(isDestructiveTool('ask_user')).toBe(false);
    expect(isDestructiveTool('complete')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDestructiveTool('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createApprovalHook
// ---------------------------------------------------------------------------

describe('createApprovalHook', () => {
  it('returns handler, id, and priority', () => {
    const gate = createMockGate(true);
    const hook = createApprovalHook(gate);

    expect(hook).toHaveProperty('handler');
    expect(typeof hook.handler).toBe('function');
    expect(hook.id).toBe('approval:destructive-gate');
    expect(hook.priority).toBe(100);
  });

  it('passes through without calling gate for non-destructive tools', async () => {
    const gate = createMockGate(true);
    const hook = createApprovalHook(gate);

    const result = await hook.handler(createPreToolCall({ toolName: 'read' }));

    expect(result).toEqual({ continue: true });
    expect(gate.requestApproval).not.toHaveBeenCalled();
  });

  it('calls gate and continues when user approves a destructive tool', async () => {
    const gate = createMockGate(true);
    const hook = createApprovalHook(gate);

    const result = await hook.handler(
      createPreToolCall({
        toolName: 'delete_file',
        args: { path: resolve(import.meta.dirname, '__fixtures__', 'test.txt') }
      })
    );

    expect(result).toEqual({ continue: true });
    expect(gate.requestApproval).toHaveBeenCalledWith('delete_file', {
      path: resolve(import.meta.dirname, '__fixtures__', 'test.txt')
    });
  });

  it('blocks when user rejects a destructive tool', async () => {
    const gate = createMockGate(false);
    const hook = createApprovalHook(gate);

    const result = await hook.handler(createPreToolCall({ toolName: 'write', args: { content: 'hello' } }));

    expect(result).toEqual({
      continue: false,
      reason: 'Operation rejected by user: "write" requires approval'
    });
    expect(gate.requestApproval).toHaveBeenCalledWith('write', { content: 'hello' });
  });

  it('passes through non-PreToolCall events without calling gate', async () => {
    const gate = createMockGate(true);
    const hook = createApprovalHook(gate);

    const result = await hook.handler(createNonPreToolCall());

    expect(result).toEqual({ continue: true });
    expect(gate.requestApproval).not.toHaveBeenCalled();
  });

  it('isolates gate errors and continues', async () => {
    const brokenGate: ApprovalGate = {
      requestApproval: vi.fn().mockRejectedValue(new Error('Gate unavailable'))
    };
    const hook = createApprovalHook(brokenGate);

    const result = await hook.handler(createPreToolCall({ toolName: 'destroy', args: {} }));

    // Error isolation — hook continues without blocking
    expect(result).toEqual({ continue: true });
    expect(brokenGate.requestApproval).toHaveBeenCalled();
  });
});
