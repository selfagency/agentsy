import { describe, expect, it } from 'vitest';

import type { GovernancePolicy } from '../governance/policy.js';
import { PolicyEnforcer } from '../governance/policy.js';
import { createGovernanceGate } from './governance-gate.js';

function createEnforcer(): PolicyEnforcer {
  const policy: GovernancePolicy = {
    id: 'test-policy',
    name: 'Test',
    version: '1.0',
    roles: {
      admin: { name: 'admin', permissions: ['tool:*'] },
      developer: { name: 'developer', permissions: ['tool:read', 'tool:write'] }
    },
    toolAccess: [
      {
        toolName: 'restricted_tool',
        allowedRoles: ['admin'],
        requireApproval: true
      }
    ],
    approvalRules: [],
    escalationRules: [],
    budgetProfiles: [],
    auditConfig: {
      includeToolInputs: true,
      retentionDays: 90,
      sink: { type: 'console', config: {} }
    }
  };
  return new PolicyEnforcer(policy);
}

describe('createGovernanceGate', () => {
  it('should return a HookDefinition with phase "beforeToolCall" and priority 80', () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    expect(gate.name).toBe('governance:pre-tool-call');
    expect(gate.phase).toBe('beforeToolCall');
    expect(gate.priority).toBe(80);
    expect(gate.enabled).toBe(true);
    expect(gate.handler).toBeInstanceOf(Function);
  });

  it('should block unauthorized tool call via handler', async () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    const ctx = await gate.handler({
      agentId: 'agent-1',
      role: 'developer',
      toolName: 'restricted_tool',
      metadata: {}
    });

    expect(ctx.blocked).toBe(true);
    expect(ctx.reason).toContain('restricted_tool');
  });

  it('should allow authorized tool call via handler', async () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    const ctx = await gate.handler({
      agentId: 'agent-1',
      role: 'admin',
      toolName: 'restricted_tool',
      metadata: {}
    });

    expect(ctx.blocked).toBeUndefined();
  });

  it('should skip evaluation when toolName is undefined', async () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    const ctx = await gate.handler({
      agentId: 'agent-1',
      role: 'developer',
      metadata: {}
    });

    expect(ctx.blocked).toBeUndefined();
  });

  it('should log audit event on denied access', async () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    await gate.handler({
      agentId: 'agent-1',
      role: 'developer',
      toolName: 'restricted_tool',
      metadata: {}
    });

    const log = enforcer.getAuditLog();
    const deniedEvent = log.find(e => e.result === 'deny');
    expect(deniedEvent).toBeDefined();
    expect(deniedEvent!.resource).toBe('restricted_tool');
  });

  it('should log audit event on allowed access', async () => {
    const enforcer = createEnforcer();
    const gate = createGovernanceGate(enforcer);

    await gate.handler({
      agentId: 'agent-1',
      role: 'admin',
      toolName: 'restricted_tool',
      metadata: {}
    });

    const log = enforcer.getAuditLog();
    const allowEvent = log.find(e => e.result === 'allow');
    expect(allowEvent).toBeDefined();
    expect(allowEvent!.resource).toBe('restricted_tool');
  });
});
