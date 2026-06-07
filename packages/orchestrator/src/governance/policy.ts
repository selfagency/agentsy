/**
 * Governance policy model and enforcer for the orchestrator.
 *
 * Defines roles, permissions, approval gates, escalation rules, budget
 * profiles, and audit configuration. The `PolicyEnforcer` evaluates
 * conditions at runtime to control tool access, trigger approvals,
 * escalate errors, and capture audit events.
 *
 * Part of the governance layer (TASK-ORCH-026, Phase 4 gap 3).
 *
 * @module @agentsy/orchestrator/governance
 */

import { randomUUID } from 'node:crypto';

// =============================================================================
// Policy Types
// =============================================================================

/**
 * Top-level governance policy document.
 *
 * Maps roles and tools to access rules, approval gates, escalation
 * policies, budget profiles, and audit configuration.
 */
export interface GovernancePolicy {
  /** Ordered list of approval rules (first-match wins). */
  approvalRules: ApprovalRule[];

  /** Audit behaviour configuration. */
  auditConfig: AuditConfig;

  /** Named budget profiles. */
  budgetProfiles: BudgetProfile[];

  /** Ordered list of escalation rules (first-match wins). */
  escalationRules: EscalationRule[];

  id: string;
  name: string;

  /** Named roles keyed by role identifier. */
  roles: Record<string, Role>;

  /** Ordered list of tool-access rules. */
  toolAccess: ToolAccessRule[];

  version: string;
}

// -----------------------------------------------------------------------------
// Role
// -----------------------------------------------------------------------------

/**
 * A named role with a set of permissions and optional resource limits.
 */
export interface Role {
  /** Agent IDs that are allowed to assume this role. Omit to allow any agent. */
  allowedAgents?: string[];

  /** Maximum number of concurrent tasks this role may run. */
  maxConcurrentTasks?: number;

  /** Maximum total USD this role may consume per day across all agents. */
  maxCostUSDPerDay?: number;

  /** Human-readable role name (e.g. "admin", "developer", "readonly"). */
  name: string;

  /** Permission strings (e.g. `["tool:github_read", "tool:aws_*"]`). */
  permissions: string[];
}

// -----------------------------------------------------------------------------
// Tool Access
// -----------------------------------------------------------------------------

/**
 * A rule controlling which roles may invoke a named tool.
 */
export interface ToolAccessRule {
  /** Roles that are permitted to call this tool. */
  allowedRoles: string[];

  /** Optional budget profile to charge tool usage against. */
  budgetProfileId?: string;

  /** When `true`, tool calls require explicit human approval. */
  requireApproval: boolean;

  /** Tool identifier (e.g. "git_push", "filesystem_write"). */
  toolName: string;
}

// -----------------------------------------------------------------------------
// Approval
// -----------------------------------------------------------------------------

/**
 * A rule that triggers an approval gate when its DSL condition matches
 * the current tool-call context.
 */
export interface ApprovalRule {
  /**
   * DSL condition expression evaluated against the invocation context.
   *
   * Receives the context as `ctx` (e.g. `"ctx.toolName === 'git_push'"`).
   */
  conditional: string;

  /** Human-readable explanation of when this rule applies. */
  description: string;

  /** Role that must provide the approval (e.g. "admin", "codeowner"). */
  requiredRole: string;

  /** Unique rule identifier. */
  ruleId: string;

  /** Maximum time in milliseconds to wait for approval before denying. */
  timeoutMs: number;
}

// -----------------------------------------------------------------------------
// Escalation
// -----------------------------------------------------------------------------

/**
 * A rule that triggers escalation when its DSL condition matches an error.
 */
export interface EscalationRule {
  /**
   * DSL condition expression evaluated against the error context.
   *
   * Context shape: `{ error: { retryable: boolean, code?: string } }`.
   * Example: `"ctx.error.retryable === false"`.
   */
  condition: string;

  /** Human-readable explanation of when this rule applies. */
  description: string;

  /** Whether to fire a notification on escalation. */
  notifyOnEscalate: boolean;

  /** Unique rule identifier. */
  ruleId: string;

  /** Role to escalate to (e.g. "admin", "on-call"). */
  targetRole: string;
}

// -----------------------------------------------------------------------------
// Budget
// -----------------------------------------------------------------------------

/**
 * A named budget profile that caps cost and token usage per task and per day.
 */
export interface BudgetProfile {
  /** Unique profile identifier. */
  id: string;

  /** Maximum cost in USD per day across all tasks using this profile. */
  maxCostPerDay: number;

  /** Maximum cost in USD per single task. */
  maxCostPerTask: number;

  /** Maximum input+output tokens per day across all tasks. */
  maxTokensPerDay: number;

  /** Maximum input+output tokens per single task. */
  maxTokensPerTask: number;

  /** Human-readable name (e.g. "default", "research-heavy"). */
  name: string;
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

/**
 * Audit system configuration.
 */
export interface AuditConfig {
  /** Whether to include tool-call inputs (arguments) in audit events. */
  includeToolInputs: boolean;

  /** Number of days to retain audit events. */
  retentionDays: number;

  /** Where audit events are delivered. */
  sink: AuditSink;
}

/**
 * An audit-sink destination.
 */
export interface AuditSink {
  /** Arbitrary sink-specific configuration (path, URL, headers, etc.). */
  config: Record<string, unknown>;

  /** Sink type. */
  type: 'console' | 'file' | 'webhook';
}

// -----------------------------------------------------------------------------
// Audit Event
// -----------------------------------------------------------------------------

/**
 * A single audit event recording a governance decision or action.
 */
export interface AuditEvent {
  /** Action that triggered the event (e.g. "tool_call", "approval", "escalation"). */
  action: string;

  /** Agent that performed the action. */
  agentId: string;

  /** Additional structured details. */
  details: Record<string, unknown>;

  /** Unique event identifier (UUID). */
  id: string;

  /** Resource the action was performed on (e.g. tool name, rule ID). */
  resource: string;

  /** Outcome of the governance check. */
  result: 'allow' | 'deny' | 'error' | 'pending';

  /** Session that originated the event. */
  sessionId: string;

  /** When the event was recorded. */
  timestamp: Date;
}

// =============================================================================
// PolicyEnforcer
// =============================================================================

/**
 * Runtime enforcer that evaluates governance policy rules for tool access,
 * approval requirements, escalation triggers, and audit logging.
 *
 * Construct with a `GovernancePolicy` and call the relevant check methods
 * before tool execution and state mutations.
 */
export class PolicyEnforcer {
  /** In-memory audit-event store. */
  readonly #auditLog: AuditEvent[] = [];

  /** The governance policy this enforcer evaluates against. */
  readonly policy: GovernancePolicy;

  constructor(policy: GovernancePolicy) {
    this.policy = policy;
  }

  /**
   * Check whether an agent with the given role may invoke a tool.
   *
   * Iterates the policy's `toolAccess` rules. If no rule matches the tool
   * name, access is **allowed by default** so that unlisted tools are not
   * inadvertently blocked. Returns the access decision plus a reason when
   * access is denied.
   *
   * @param _agentId - The agent requesting access.
   * @param role    - The role the agent is acting under.
   * @param toolName - The tool being invoked.
   */
  checkToolAccess(_agentId: string, role: string, toolName: string): { allowed: boolean; reason?: string } {
    const rule = this.policy.toolAccess.find(r => r.toolName === toolName);
    if (!rule) {
      return { allowed: true };
    }

    if (!rule.allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `Role "${role}" is not allowed to use tool "${toolName}"`
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluate approval rules against the current tool-call context.
   *
   * Returns the **first** matching `ApprovalRule`, or `undefined` if no
   * rule's DSL condition evaluates to `true`. Rules are evaluated in
   * the order they appear in the policy.
   *
   * @param context - The tool-call context (tool name, arguments, agent ID, etc.).
   */
  checkApprovalRule(context: Record<string, unknown>): ApprovalRule | undefined {
    for (const rule of this.policy.approvalRules) {
      if (evaluateCondition(rule.conditional, context)) {
        return rule;
      }
    }
    return;
  }

  /**
   * Find the first escalation rule whose DSL condition matches the error.
   *
   * Builds a context object from `{ error: { retryable, code } }` and
   * evaluates each escalation rule's condition. Returns the first match
   * or `undefined`.
   *
   * @param error - The error descriptor.
   */
  getEscalationRule(error: { retryable: boolean; code?: string }): EscalationRule | undefined {
    const context: Record<string, unknown> = {
      error: {
        retryable: error.retryable,
        code: error.code
      }
    };

    for (const rule of this.policy.escalationRules) {
      if (evaluateCondition(rule.condition, context)) {
        return rule;
      }
    }
    return;
  }

  /**
   * Persist an audit event.
   *
   * Generates a unique `id` and captures the current `timestamp`, stores
   * the event in the internal audit log, and returns the fully resolved
   * `AuditEvent`.
   *
   * @param event - Partial event data (id and timestamp are auto-generated).
   */
  logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const resolved: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date()
    };
    this.#auditLog.push(resolved);
    return resolved;
  }

  /**
   * Return a read-only view of the in-memory audit log.
   */
  getAuditLog(): readonly AuditEvent[] {
    return this.#auditLog;
  }
}

// =============================================================================
// Condition DSL Evaluator
// =============================================================================

/**
 * Evaluate a DSL condition expression against a context object.
 *
 * Uses `new Function()` to compile the expression at runtime. The
 * expression receives the context as `ctx` — for example:
 *
 * ```ts
 * evaluateCondition("ctx.toolName === 'git_push'", { toolName: 'git_push' }) // true
 * ```
 *
 * On any evaluation error (syntax error, ReferenceError, etc.) the
 * function returns `false` so that a misconfigured rule defaults to
 * _not matching_ rather than crashing the caller.
 *
 * @param condition - DSL expression (e.g. `"ctx.toolName === 'escalate'"`).
 * @param context   - The data available to the expression as `ctx`.
 */
export function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  try {
    const fn = new Function('ctx', `return ${condition}`);
    const result = fn(context);
    return Boolean(result);
  } catch {
    return false;
  }
}
