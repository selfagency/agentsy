import type { HookResult, PreToolCallEvent, RuntimeHookEvent } from '../hooks/types.js';
import type { ApprovalManager } from './approval-manager.js';

/**
 * A simple policy rule that matches a tool name.
 */
export type PolicyApprovalAction = 'allow' | 'deny' | 'require_approval';

export interface ToolPolicyRule {
  /** Action to take. */
  readonly action: PolicyApprovalAction;
  /** Optional human-readable label for diagnostics. */
  readonly label?: string;
  /** Glob or exact tool name pattern (`*` matches any suffix). */
  readonly pattern: string;
}

/**
 * Options for the policy-backed approval hook.
 */
export interface PolicyApprovalHookOptions {
  /** The ApprovalManager instance for interactive approvals. */
  approvalManager: ApprovalManager;

  /**
   * Default action when no rule matches. Defaults to `require_approval`.
   */
  defaultAction?: 'allow' | 'deny' | 'require_approval';

  /**
   * Ordered list of tool policy rules.
   * First match wins. When no rule matches, the default action is used.
   */
  policyRules?: ToolPolicyRule[];

  /**
   * Hook priority. Defaults to 100 (runs after guardrails at 75).
   */
  priority?: number;
}

/**
 * Create a pre-tool-call hook that evaluates tool policy rules and requests
 * approval for operations that require it.
 *
 * This is a higher-level replacement for `createApprovalHook` that uses
 * structured patterns instead of a fixed destructive-keyword list.
 *
 * ## Rule matching
 * - `*` matches any tool name (catch-all)
 * - `prefix*` matches any tool whose name starts with `prefix`
 * - Exact names match literally
 *
 * Fires on `PreToolCall`. Priority defaults to 100.
 */
export function createPolicyApprovalHook(options: PolicyApprovalHookOptions): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  const { approvalManager, defaultAction = 'require_approval' } = options;
  const rules = options.policyRules ?? [];

  return {
    id: 'approval:policy-gate',
    priority: options.priority ?? 100,
    handler: (event: RuntimeHookEvent): Promise<HookResult> => {
      if (event.type !== 'PreToolCall') {
        return Promise.resolve(allowResult());
      }
      return evaluatePolicy(rules, defaultAction, approvalManager, event);
    }
  };
}

/**
 * Evaluate tool policy rules and return the appropriate HookResult.
 */
function evaluatePolicy(
  rules: ToolPolicyRule[],
  defaultAction: PolicyApprovalAction,
  approvalManager: ApprovalManager,
  event: PreToolCallEvent
): Promise<HookResult> {
  try {
    const matchedRule = findFirstMatchingRule(rules, event.toolName);

    if (matchedRule !== null) {
      return executeRuleAction(matchedRule, event, approvalManager);
    }

    // No rule matched — use default action
    return applyDefaultAction(defaultAction, approvalManager, event);
  } catch {
    return Promise.resolve(denyResult('Policy evaluation error — denied by default'));
  }
}

/**
 * Execute the action for a matched rule.
 */
function executeRuleAction(
  rule: ToolPolicyRule,
  event: PreToolCallEvent,
  approvalManager: ApprovalManager
): Promise<HookResult> {
  if (rule.action === 'allow') {
    return Promise.resolve(allowResult());
  }

  if (rule.action === 'deny') {
    return Promise.resolve(
      denyResult(`Policy denies: "${event.toolName}" matches rule "${rule.label ?? rule.pattern}"`)
    );
  }

  // rule.action === 'require_approval'
  return requireApprovalResult(approvalManager, event.toolName, event.args as Record<string, unknown>);
}

/**
 * Create an allow result.
 */
function allowResult(): HookResult {
  return { continue: true };
}

/**
 * Find the first policy rule whose pattern matches the event's tool name, or null.
 */
function findFirstMatchingRule(rules: ToolPolicyRule[], toolName: string): ToolPolicyRule | null {
  for (const rule of rules) {
    if (!matchToolPattern(rule.pattern, toolName)) {
      continue;
    }
    return rule;
  }
  return null;
}

/**
 * Apply the default action when no rule matched.
 */
function applyDefaultAction(
  defaultAction: 'allow' | 'deny' | 'require_approval',
  approvalManager: ApprovalManager,
  event: PreToolCallEvent
): Promise<HookResult> {
  if (defaultAction === 'allow') {
    return Promise.resolve(allowResult());
  }

  if (defaultAction === 'deny') {
    return Promise.resolve(denyResult(`Policy denies (default): "${event.toolName}" is not explicitly allowed`));
  }

  // defaultAction === 'require_approval'
  return requireApprovalResult(approvalManager, event.toolName, event.args as Record<string, unknown>);
}

/**
 * Create a deny result with the given reason.
 */
function denyResult(reason: string): HookResult {
  return { continue: false, reason };
}

/**
 * Request approval via the ApprovalManager and return the appropriate HookResult.
 */
function requireApprovalResult(
  approvalManager: ApprovalManager,
  toolName: string,
  args: Record<string, unknown>
): Promise<HookResult> {
  return approvalManager.requestApproval(toolName, args).then(approved => {
    if (approved) {
      return { continue: true } satisfies HookResult;
    }
    return {
      continue: false,
      reason: `Operation rejected by user: "${toolName}" requires approval`
    } satisfies HookResult;
  });
}

/**
 * Match a tool name against a pattern.
 *
 * - `*` matches everything
 * - `prefix*` matches any name starting with `prefix`
 * - Exact match otherwise
 */
function matchToolPattern(pattern: string, toolName: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return toolName.startsWith(prefix);
  }
  return toolName === pattern;
}
