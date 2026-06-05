/**
 * Routing constraint types and enforcer for guardrails.
 *
 * These constraints are evaluated BEFORE gateway model selection.
 * When a constraint is violated, the enforcer returns a contestable
 * `ConstraintViolation` with a reason code, rather than failing
 * silently.
 *
 * Guardrails handles content policy (prompt injection, PII, ethics).
 * Routing constraints handle authorization (local-only, provider
 * exclusion, compliance rules). They share the runtime hook
 * substrate but live in different conceptual namespaces.
 */

// =============================================================================
// Constraint types
// =============================================================================

/**
 * A constraint that must be satisfied before a model call is routed.
 * Multiple constraints can be combined — they are ANDed together.
 */
export interface RoutingConstraint {
  /** Exclude specific providers by id. */
  excludeProviders?: string[];
  /** Force local-only routing. Conflicts with excludeLocal. */
  localOnly?: boolean;

  /** Require specific capabilities. */
  requireJsonMode?: boolean;
  requireReasoning?: boolean;
  requireTools?: boolean;
  requireVision?: boolean;

  /** Optional tag for diagnostics (e.g. 'compliance-policy'). */
  tag?: string;
}

// =============================================================================
// Violation model
// =============================================================================

export type ConstraintViolationCode =
  | 'provider-excluded'
  | 'local-only-no-local-available'
  | 'missing-capability-json'
  | 'missing-capability-reasoning'
  | 'missing-capability-tools'
  | 'missing-capability-vision';

/**
 * Describes a single constraint violation. Multiple violations
 * may be returned for one routing decision.
 */
export interface ConstraintViolation {
  code: ConstraintViolationCode;
  constraint: RoutingConstraint;
  details: string;
}

// =============================================================================
// Evaluator types
// =============================================================================

export interface GatewayModelInfo {
  capabilities: {
    jsonMode: boolean;
    reasoning: boolean;
    tools: boolean;
    vision: boolean;
  };
  isLocal: boolean;
  providerId: string;
}

/**
 * Result of evaluating constraints against a model candidate.
 */
export interface ConstraintEvalResult {
  /** Whether the model satisfies all constraints. */
  pass: boolean;
  /** Violations (empty when pass is true). */
  violations: ConstraintViolation[];
}

// =============================================================================
// Enforcer
// =============================================================================

/**
 * Evaluate all constraints against a model candidate.
 * Returns all violations, not just the first.
 */
export function evaluateConstraints(constraint: RoutingConstraint, model: GatewayModelInfo): ConstraintEvalResult {
  const violations: ConstraintViolation[] = [];

  // Local-only
  if (constraint.localOnly === true && !model.isLocal) {
    violations.push({
      code: 'local-only-no-local-available',
      constraint,
      details: `Constraint requires local-only routing, but ${model.providerId} is a cloud provider`
    });
  }

  // Excluded providers
  if (constraint.excludeProviders?.includes(model.providerId)) {
    violations.push({
      code: 'provider-excluded',
      constraint,
      details: `${model.providerId} is in the excluded providers list`
    });
  }

  // Required capabilities
  if (constraint.requireJsonMode === true && !model.capabilities.jsonMode) {
    violations.push({
      code: 'missing-capability-json',
      constraint,
      details: 'Model does not support JSON mode'
    });
  }
  if (constraint.requireReasoning === true && !model.capabilities.reasoning) {
    violations.push({
      code: 'missing-capability-reasoning',
      constraint,
      details: 'Model does not support extended reasoning'
    });
  }
  if (constraint.requireTools === true && !model.capabilities.tools) {
    violations.push({
      code: 'missing-capability-tools',
      constraint,
      details: 'Model does not support function calling'
    });
  }
  if (constraint.requireVision === true && !model.capabilities.vision) {
    violations.push({
      code: 'missing-capability-vision',
      constraint,
      details: 'Model does not support vision input'
    });
  }

  return { pass: violations.length === 0, violations };
}
