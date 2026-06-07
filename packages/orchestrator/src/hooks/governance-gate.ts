/**
 * @module Governance gate hook — RBAC enforcement, approval rules, audit logging.
 *
 * Provides a hook that runs before every tool call to enforce governance
 * policy: checks RBAC tool access, evaluates approval rules, and logs
 * all decisions as audit events.
 *
 * @example
 * ```ts
 * import { createGovernanceGate } from './hooks/governance-gate.js';
 *
 * const gate = createGovernanceGate(enforcer);
 * // gate.phase === 'beforeToolCall'
 * // gate.priority === 80
 * ```
 */

import type { PolicyEnforcer } from '../governance/policy.js';
import type { HookDefinition } from './types.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface HookContext {
  /** The agent requesting execution. */
  agentId: string;

  /** When `true` the hook chain has blocked execution. */
  blocked?: boolean;

  /** Error raised during execution. */
  error?: Error;

  /** Arbitrary metadata key-value store. */
  metadata: Record<string, unknown>;

  /** Human-readable reason for a block or denial. */
  reason?: string;

  /** Role the agent is acting under (e.g. "admin", "developer"). */
  role: string;

  /** Arguments passed to the tool. */
  toolInput?: unknown;

  /** Name of the tool being called (set during tool-call phases). */
  toolName?: string;

  /** Result returned by the tool. */
  toolOutput?: unknown;

  /** Allow extension by other hooks via string keys. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

/** Hook handler function signature. */
type HookHandler = (ctx: HookContext) => Promise<HookContext>;

/**
 * A {@link HookDefinition} paired with its handler function.
 */
export type GovernanceGateHook = HookDefinition & {
  handler: HookHandler;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGovernanceGate(policyEnforcer: PolicyEnforcer): GovernanceGateHook {
  return {
    name: 'governance:pre-tool-call',
    phase: 'beforeToolCall',
    priority: 80,
    enabled: true,

    handler: (ctx: HookContext): Promise<HookContext> => {
      // Skip evaluation when there is no tool to check.
      if (ctx.toolName === undefined || ctx.role === undefined) {
        return Promise.resolve(ctx);
      }

      const toolName: string = ctx.toolName;
      const role: string = ctx.role;
      const sessionId = typeof ctx.metadata.sessionId === 'string' ? ctx.metadata.sessionId : 'unknown';

      // ---- 1. RBAC tool access check ---------------------------------------

      const access = policyEnforcer.checkToolAccess(ctx.agentId, role, toolName);

      if (!access.allowed) {
        policyEnforcer.logAuditEvent({
          agentId: ctx.agentId,
          action: 'tool_call',
          resource: toolName,
          result: 'deny',
          sessionId,
          details: { reason: access.reason, role }
        });

        return Promise.resolve({
          ...ctx,
          blocked: true,
          reason: access.reason ?? 'Access denied by governance policy'
        });
      }

      // ---- 2. Approval rule check ------------------------------------------

      const approvalContext: Record<string, unknown> = {
        toolName,
        toolInput: ctx.toolInput,
        agentId: ctx.agentId,
        role,
        ...ctx.metadata
      };

      const matchedRule = policyEnforcer.checkApprovalRule(approvalContext);

      if (matchedRule) {
        policyEnforcer.logAuditEvent({
          agentId: ctx.agentId,
          action: 'approval',
          resource: toolName,
          result: 'pending',
          sessionId,
          details: {
            ruleId: matchedRule.ruleId,
            requiredRole: matchedRule.requiredRole,
            description: matchedRule.description
          }
        });

        return Promise.resolve({
          ...ctx,
          blocked: true,
          reason: `Tool "${toolName}" requires approval from role "${matchedRule.requiredRole}"`
        });
      }

      // ---- 3. Log allowed access -------------------------------------------

      policyEnforcer.logAuditEvent({
        agentId: ctx.agentId,
        action: 'tool_call',
        resource: toolName,
        result: 'allow',
        sessionId,
        details: { role }
      });

      return Promise.resolve(ctx);
    }
  };
}
