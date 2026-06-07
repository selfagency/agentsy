// Core exports

// Agent registry and discovery
export { AgentRegistry } from './agents/registry.js';
export { OrchestrationEngine } from './core/engine.js';
// Model-tier routing (delegates to gateway)
export {
  DEFAULT_ESCALATION_POLICY,
  type EscalationPolicy,
  GatewayBackedModelRouter,
  NO_ESCALATION_POLICY,
  type SelectionRecord,
  type TaskTier,
  type TierAwareModelRouter,
  type TierAwareModelRouterOptions
} from './intelligence/model-router.js';
export {
  createReplicaHealthProbe,
  type HealthProbeResult,
  ReplicaHealthProbe,
  type ReplicaHealthProbeConfig
} from './recovery/health-probe.js';
export { createOrchestratorLoop } from './orchestrator-loop.js';
// Recovery / multi-replica failover chain
export {
  createFailoverChain,
  ExhaustedError,
  type FailoverChain,
  type FailoverStep,
  type FailoverStepType,
  getNextStep
} from './recovery/model-failover.js';
// Recovery / rate-limit escalation
export {
  allReplicasRateLimited,
  buildRateLimitMap,
  getUnlimitedReplicas,
  RateLimitExceededError,
  type RateLimitStatus
} from './recovery/rate-limit-escalation.js';
// Circuit-breaker state tracking per replica
export {
  type CircuitBreakerConfig,
  type CircuitBreakerEntry,
  CircuitBreakerSet,
  type CircuitState,
  createCircuitBreakerSet
} from './recovery/circuit-breaker-set.js';
// Scheduler exports (consolidated from @agentsy/orchestrator/scheduler)
export * from './scheduler/index.js';
// Type definitions
export * from './types/index.js';
// Utilities
export * from './utils/matching.js';
export * from './utils/timing.js';
