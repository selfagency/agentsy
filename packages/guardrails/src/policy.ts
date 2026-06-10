/**
 * Policy as code — YAML-driven guardrail policy documents.
 *
 * Inspired by Microsoft Agent Governance Toolkit's policy model.
 * Each rule maps a condition over tool or agent annotations to an action.
 */

import type { GuardrailPhase } from './types.js';

// =============================================================================
// Policy document types
// =============================================================================

/**
 * Action taken when a policy rule matches.
 *
 * - `deny`: Block execution — equivalent to a guardrail `block` result.
 * - `require_approval`: Escalate for human approval — equivalent to `escalate`.
 * - `allow`: Explicitly allow (overrides other rules).
 * - `log`: Record the event but do not block.
 * - `redact`: Remove matched content from input/output.
 */
export type PolicyAction = 'deny' | 'require_approval' | 'allow' | 'log' | 'redact';

/**
 * A single policy rule with a condition and action.
 */
export interface PolicyRule {
  /** Action to take when the condition matches. */
  readonly action: PolicyAction;
  /** Path expression that evaluates to a boolean (e.g. 'tool.annotations.destructiveHint == true'). */
  readonly condition: string;
  /** Description of what this rule guards against. */
  readonly description?: string;
  /** Human-readable name for diagnostics and audit logs. */
  readonly name: string;
  /** Which phase this rule applies to. */
  readonly phase?: GuardrailPhase;
  /** Optional severity override. */
  readonly severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Full policy document loaded from `.agentsy/policy.yaml`.
 */
export interface PolicyDocument {
  /** Optional description of this policy. */
  readonly description?: string;
  /** Ordered list of rules (first match wins). */
  readonly rules: readonly PolicyRule[];
  /** Policy schema version. */
  readonly version: string;
}

// =============================================================================
// Evaluation context — the data available to condition expressions
// =============================================================================

export interface PolicyContext {
  readonly input?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly tool?: {
    readonly name: string;
    readonly annotations?: Record<string, boolean | undefined>;
  };
}

// =============================================================================
// Policy evaluation result
// =============================================================================

export interface PolicyEvalResult {
  readonly action?: PolicyAction;
  readonly matched: boolean;
  readonly rule?: PolicyRule;
}

// =============================================================================
// Simple condition evaluator
// =============================================================================

/**
 * Evaluate a condition string against a policy context.
 *
 * Supported expressions (simple equality and presence checks):
 * - `tool.name == 'shell_exec'` — string equality
 * - `tool.annotations.destructiveHint == true` — boolean check
 * - `tool.annotations.destructiveHint` — truthy check
 * - `tool.annotations.destructiveHint == false` — negation check
 * - `input.path starts_with '/tmp/'` — prefix match
 * - `input.path contains '..'` — substring match
 * - `expr && expr` — logical AND (higher precedence than ||)
 * - `expr || expr` — logical OR
 */
export function evaluateCondition(condition: string, context: PolicyContext): boolean {
  const trimmed = condition.trim();

  // Handle || for test compatibility (e.g. tool.name == "repl_execute" || tool.name == "shell_exec")
  // Split on || but not inside quotes — simple approach: split top-level only
  const orParts = splitAtTopLevel(trimmed, '||');
  if (orParts.length > 1) {
    return orParts.some(part => evaluateCondition(part, context));
  }

  // Handle && (logical AND)
  const andParts = splitAtTopLevel(trimmed, '&&');
  if (andParts.length > 1) {
    return andParts.every(part => evaluateCondition(part, context));
  }

  // Strip outer parens
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return evaluateCondition(trimmed.slice(1, -1), context);
  }

  // <string> starts_with <string>
  const startsWithMatch = /^(.+?)\s+starts_with\s+'(.+)'$/.exec(trimmed);
  if (startsWithMatch) {
    const [, leftPath, rightVal] = startsWithMatch;
    const value = resolvePath(leftPath, context);
    if (typeof value === 'string') {
      return value.startsWith(rightVal);
    }
    return false;
  }

  // <string> contains <string>
  const containsMatch = /^(.+?)\s+contains\s+'(.+)'$/.exec(trimmed);
  if (containsMatch) {
    const [, leftPath, rightVal] = containsMatch;
    const value = resolvePath(leftPath, context);
    if (typeof value === 'string') {
      return value.includes(rightVal);
    }
    return false;
  }

  // <path> == <value> — resolve left as path OR literal
  const equalsMatch = /^(.+?)\s+==\s+(.+)$/.exec(trimmed);
  if (equalsMatch) {
    const leftRaw = equalsMatch[1]?.trim();
    const rightRaw = equalsMatch[2]?.trim();
    // Try resolving left as a path first
    const left = resolvePath(leftRaw, context);
    // If path resolution fails and leftRaw looks like a literal, parse it
    const leftVal = left === undefined && leftRaw !== 'undefined' ? parseLiteral(leftRaw) : left;
    const rightVal = parseLiteral(rightRaw);
    return leftVal === rightVal;
  }

  // <path> (truthy) — resolve as path only
  const value = resolvePath(trimmed, context);
  return value === true || value !== undefined;
}

/**
 * Split a string by a delimiter only at the top level (not inside parentheses
 * or single/double-quoted strings). Used for && and || splitting.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: state machine with necessary quote/paren/delimiter tracking
function splitAtTopLevel(input: string, delimiter: '&&' | '||'): string[] {
  if (!input.includes(delimiter)) {
    return [input];
  }

  const results: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    const lookahead = input.slice(i, i + delimiter.length);

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
    if (!(inSingleQuote || inDoubleQuote)) {
      if (ch === '(') {
        depth++;
      }
      if (ch === ')') {
        depth--;
      }
    }

    if (!(inSingleQuote || inDoubleQuote) && depth === 0 && lookahead === delimiter) {
      results.push(current.trim());
      current = '';
      i += delimiter.length - 1;
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    results.push(current.trim());
  }
  return results;
}

/**
 * Resolve a dot-separated path against a policy context.
 */
function resolvePath(path: string, context: PolicyContext): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return;
    }
    if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return;
    }
  }
  return current;
}

/**
 * Parse a literal value from an expression.
 */
function parseLiteral(literal: string): string | boolean | number | null {
  const trimmed = literal.trim();
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num)) {
    return num;
  }
  // Strip surrounding quotes for string literals
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// =============================================================================
// Policy engine
// =============================================================================

/**
 * Evaluate a policy document against a context and return the first
 * matching rule's action, or `null` if no rule matches.
 */
export function evaluatePolicy(document: PolicyDocument, context: PolicyContext): PolicyEvalResult {
  for (const rule of document.rules) {
    if (evaluateCondition(rule.condition, context)) {
      return { matched: true, rule, action: rule.action };
    }
  }
  return { matched: false };
}

/**
 * Default policy document template with recommended safety rules.
 */
export const DEFAULT_POLICY: PolicyDocument = {
  version: '1.0',
  description: 'Default Agentsy safety policy — deny-by-default for destructive open-world operations.',
  rules: [
    {
      name: 'deny-destructive-open-world-writes',
      description: 'Block tools that are both destructive and touch external systems without explicit approval.',
      condition:
        'tool.annotations.destructiveHint == true && tool.annotations.openWorldHint == true && tool.annotations.requiresApproval == true',
      action: 'deny',
      phase: 'tool-input',
      severity: 'critical'
    },
    {
      name: 'require-approval-code-execution',
      description: 'Code execution tools require human approval.',
      condition: 'tool.name == "repl_execute" || tool.name == "shell_exec"',
      action: 'require_approval',
      phase: 'tool-input',
      severity: 'high'
    },
    {
      name: 'allow-read-only-tools',
      description: 'Read-only tools are always allowed.',
      condition: 'tool.annotations.readOnlyHint == true',
      action: 'allow',
      phase: 'tool-input'
    }
  ]
};
