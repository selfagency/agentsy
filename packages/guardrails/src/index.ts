/**
 * Safety and security guardrails for the Agentsy platform.
 */

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

export type {
  ConstraintEvalResult,
  ConstraintViolation,
  ConstraintViolationCode,
  GatewayModelInfo,
  RoutingConstraint
} from './routing-constraints.js';
// Routing constraints (Phase 3.7)
export { evaluateConstraints } from './routing-constraints.js';
