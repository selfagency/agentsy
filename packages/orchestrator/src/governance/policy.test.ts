import { describe, expect, it } from 'vitest';

import type { GovernancePolicy } from './policy.js';
import { PolicyEnforcer, evaluateCondition } from './policy.js';

function createTestPolicy(): GovernancePolicy {
  return {
    id: 'policy-1',
    name: 'Test Policy',
    version: '1.0',
    roles: {
      admin: { name: 'admin', permissions: ['tool:*'] },
      developer: { name: 'developer', permissions: ['tool:read', 'tool:write'] },
      readonly: { name: 'readonly', permissions: ['tool:read'] }
    },
    toolAccess: [
      {
        toolName: 'git_push',
        allowedRoles: ['admin'],
        requireApproval: true
      },
      {
        toolName: 'file_write',
        allowedRoles: ['admin', 'developer'],
        requireApproval: false
      }
    ],
    approvalRules: [
      {
        ruleId: 'approval-prod-deploy',
        description: 'Deploy to production requires admin approval',
        conditional: "ctx.toolName === 'git_push'",
        requiredRole: 'admin',
        timeoutMs: 60_000
      }
    ],
    escalationRules: [
      {
        ruleId: 'escalate-non-retryable',
        description: 'Non-retryable errors escalate to admin',
        condition: 'ctx.error.retryable === false',
        targetRole: 'admin',
        notifyOnEscalate: true
      }
    ],
    budgetProfiles: [
      {
        id: 'default',
        name: 'default',
        maxCostPerTask: 10,
        maxCostPerDay: 100,
        maxTokensPerTask: 100_000,
        maxTokensPerDay: 1_000_000
      }
    ],
    auditConfig: {
      includeToolInputs: true,
      retentionDays: 90,
      sink: { type: 'console', config: {} }
    }
  };
}

describe('PolicyEnforcer', () => {
  describe('checkToolAccess', () => {
    it('should allow access when role is in allowedRoles', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const result = enforcer.checkToolAccess('agent-1', 'admin', 'git_push');
      expect(result.allowed).toBe(true);
    });

    it('should deny access when role is not in allowedRoles', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const result = enforcer.checkToolAccess('agent-1', 'readonly', 'git_push');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('readonly');
      expect(result.reason).toContain('git_push');
    });

    it('should allow access when tool has no matching rule', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const result = enforcer.checkToolAccess('agent-1', 'readonly', 'unknown_tool');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkApprovalRule', () => {
    it('should return matching rule when condition evaluates to true', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const rule = enforcer.checkApprovalRule({ toolName: 'git_push', role: 'developer' });
      expect(rule).toBeDefined();
      expect(rule!.ruleId).toBe('approval-prod-deploy');
    });

    it('should return undefined when no rule matches', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const rule = enforcer.checkApprovalRule({ toolName: 'file_write', role: 'developer' });
      expect(rule).toBeUndefined();
    });
  });

  describe('getEscalationRule', () => {
    it('should return matching rule for non-retryable error', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const rule = enforcer.getEscalationRule({ retryable: false });
      expect(rule).toBeDefined();
      expect(rule!.ruleId).toBe('escalate-non-retryable');
    });

    it('should return undefined for retryable error that does not match', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const rule = enforcer.getEscalationRule({ retryable: true });
      expect(rule).toBeUndefined();
    });
  });

  describe('logAuditEvent', () => {
    it('should return an AuditEvent with id and timestamp', () => {
      const enforcer = new PolicyEnforcer(createTestPolicy());
      const event = enforcer.logAuditEvent({
        action: 'tool_call',
        agentId: 'agent-1',
        resource: 'git_push',
        result: 'allow',
        sessionId: 'session-1',
        details: { role: 'admin' }
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.action).toBe('tool_call');
      expect(event.result).toBe('allow');

      // Should also be in the audit log
      const log = enforcer.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0]!.id).toBe(event.id);
    });
  });
});

describe('evaluateCondition', () => {
  it('should evaluate a simple equality condition as true', () => {
    expect(evaluateCondition("ctx.toolName === 'git_push'", { toolName: 'git_push' })).toBe(true);
  });

  it('should evaluate a simple equality condition as false', () => {
    expect(evaluateCondition("ctx.toolName === 'git_push'", { toolName: 'file_write' })).toBe(false);
  });

  it('should return false for malformed conditions', () => {
    expect(evaluateCondition('ctx.broken..', {})).toBe(false);
  });

  it('should evaluate nested context fields', () => {
    expect(
      evaluateCondition('ctx.error.retryable === false', {
        error: { retryable: false }
      })
    ).toBe(true);
  });
});
