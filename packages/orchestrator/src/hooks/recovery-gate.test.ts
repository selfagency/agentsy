import { describe, expect, it } from 'vitest';

import type { RecoveryPolicy } from '../recovery/policy.js';
import { createRecoveryHook } from './recovery-gate.js';

function createRecoveryPolicy(): RecoveryPolicy {
  return {
    retryConfig: {
      maxAttempts: 2,
      backoffStrategy: 'fixed',
      baseDelayMs: 5,
      maxDelayMs: 1000,
      jitterFraction: 0
    },
    fallbacks: [],
    escalationAction: 'escalate',
    checkpointRequired: false,
    checkpointFrequencyMs: 5000
  };
}

describe('createRecoveryHook', () => {
  it('should return a HookDefinition with phase "afterToolCall" and priority 20', () => {
    const hook = createRecoveryHook(createRecoveryPolicy());

    expect(hook.name).toBe('recovery:post-tool-call');
    expect(hook.phase).toBe('afterToolCall');
    expect(hook.priority).toBe(20);
    expect(hook.enabled).toBe(true);
  });

  it('should trigger RecoveryExecutor when context has an error', async () => {
    const hook = createRecoveryHook(createRecoveryPolicy());
    const error = new Error('tool failed');

    const result = await hook.handler({
      agentId: 'agent-1',
      role: 'developer',
      toolName: 'some_tool',
      toolInput: { arg: 1 },
      error,
      metadata: {}
    });

    // Recovery was attempted — error remains since escalation is 'escalate'
    const recoveryResult = result.metadata.recoveryResult as { recovered: boolean; attempts: number } | undefined;
    expect(recoveryResult).toBeDefined();
    expect(recoveryResult?.recovered).toBe(false);
    expect(recoveryResult?.attempts).toBe(2);
  });

  it('should no-op when context has no error', async () => {
    const hook = createRecoveryHook(createRecoveryPolicy());

    const ctx = {
      agentId: 'agent-1',
      role: 'developer',
      toolName: 'some_tool',
      toolOutput: { result: 'ok' },
      metadata: {}
    };

    const result = await hook.handler(ctx);

    // When no error, the handler returns ctx unchanged
    expect(result.error).toBeUndefined();
    expect(result.metadata.recoveryResult).toBeUndefined();
  });
});
