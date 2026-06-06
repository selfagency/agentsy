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
export { createOrchestratorLoop } from './orchestrator-loop.js';
// Recovery / multi-replica failover chain
export {
  createFailoverChain,
  type FailoverChain,
  ExhaustedError,
  type FailoverStep,
  type FailoverStepType,
  getNextStep
} from './recovery/model-failover.js';
// Replica health probing
export {
  createReplicaHealthProbe,
  type HealthProbeResult,
  type ReplicaHealthProbeConfig,
  ReplicaHealthProbe
} from './recovery/health-probe.js';
// Scheduler exports (consolidated from @agentsy/orchestrator/scheduler)
export * from './scheduler/index.js';
// Type definitions
export * from './types/index.js';
// Utilities
export * from './utils/matching.js';
export * from './utils/timing.js';
