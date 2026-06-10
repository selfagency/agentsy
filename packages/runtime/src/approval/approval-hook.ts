import type { HookResult, RuntimeHookEvent } from '../hooks/types.js';
import type { ApprovalManager } from './approval-manager.js';

/**
 * A simple policy rule that matches a tool name.
 */
export interface ToolPolicyRule {
  /** Action to take. */
  readonly action: 'allow' | 'deny' | 'require_approval';
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
      try {
        if (event.type !== 'PreToolCall') {
          return Promise.resolve({ continue: true });
        }

        // Evaluate policy rules in order
        for (const rule of rules) {
          if (!matchToolPattern(rule.pattern, event.toolName)) {
            continue;
          }

          switch (rule.action) {
            case 'allow': {
              return Promise.resolve({ continue: true });
            }
            case 'deny': {
              return Promise.resolve({
                continue: false,
                reason: `Policy denies: "${event.toolName}" matches rule "${rule.label ?? rule.pattern}"`
              });
            }
            case 'require_approval': {
              return approvalManager.requestApproval(event.toolName, event.args).then(approved => {
                if (approved) {
                  return { continue: true } satisfies HookResult;
                }
                return {
                  continue: false,
                  reason: `Operation rejected by user: "${event.toolName}" requires approval`
                } satisfies HookResult;
              });
            }
          }
        }

        // No rule matched — use default action
        switch (defaultAction) {
          case 'allow': {
            return Promise.resolve({ continue: true });
          }
          case 'deny': {
            return Promise.resolve({
              continue: false,
              reason: `Policy denies (default): "${event.toolName}" is not explicitly allowed`
            });
          }
          case 'require_approval': {
            return approvalManager.requestApproval(event.toolName, event.args).then(approved => {
              if (approved) {
                return { continue: true } satisfies HookResult;
              }
              return {
                continue: false,
                reason: `Operation rejected by user: "${event.toolName}" requires approval`
              } satisfies HookResult;
            });
          }
        }
      } catch {
        return Promise.resolve({ continue: true });
      }
    }
  };
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
