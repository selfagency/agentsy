/**
 * Safety and security guardrails for the Agentsy platform.
 *
 * ## Architecture
 *
 * - **GuardrailScanner** — individual policy checks (injection, PII, secrets, …)
 * - **GuardrailPipeline** — priority-sorted sequential evaluation pipeline
 * - **GuardrailHub** — local registry for `hub://` guardrail URI resolution
 * - **PolicyEngine** — YAML-driven policy-as-code (Microsoft AGT pattern)
 *
 * ## Design principle
 *
 * Safety logic MUST be implemented in hooks or guardrails (deterministic),
 * never in system prompts (probabilistic). A guardrail that returns
 * `{status:'block'}` cannot be overridden by model output. A system prompt
 * instruction can be.
 */

export { GuardrailPipeline } from './pipeline.js';
export { GuardrailHub, parseHubUri, BUILTIN_GUARDRAIL_URIS } from './hub.js';
export {
  evaluateCondition,
  evaluatePolicy,
  DEFAULT_POLICY
} from './policy.js';

export type {
  GuardrailResult,
  GuardrailPhase,
  GuardrailMetadata,
  GuardrailScanner,
  Detection,
  OWASPCategory,
  PipelineConfig
} from './types.js';

export type {
  PolicyDocument,
  PolicyRule,
  PolicyAction,
  PolicyContext,
  PolicyEvalResult
} from './policy.js';

export type { HubEntry, HubUri, GuardrailFactory } from './hub.js';

// ---------------------------------------------------------------------------
// Legacy error classes (Phase 3.7)
// ---------------------------------------------------------------------------

export class QuotaExceededError extends Error {
  constructor(message = 'Token quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}
export class RetrievalBlockedError extends Error {
  constructor(message = 'Retrieval request blocked by firewall') {
    super(message);
    this.name = 'RetrievalBlockedError';
  }
}

// ---------------------------------------------------------------------------
// Routing constraints (Phase 3.7)
// ---------------------------------------------------------------------------

export type {
  ConstraintEvalResult,
  ConstraintViolation,
  ConstraintViolationCode,
  GatewayModelInfo,
  RoutingConstraint
} from './routing-constraints.js';
export { evaluateConstraints } from './routing-constraints.js';
