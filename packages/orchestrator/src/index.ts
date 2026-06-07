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
// Tier routing with budget escalation
export { TierRouter, TIER_ORDER } from './intelligence/tier-router.js';
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
// Recovery / structured error recovery framework
export { EscalationAction, RecoveryExecutor } from './recovery/policy.js';
export type {
  BackoffStrategy,
  EscalationAction as EscalationActionType,
  Fallback,
  RecoveryPolicy,
  RecoveryResult,
  RetryConfig
} from './recovery/policy.js';
// Context isolation and resource locking
export { ContextManager, type ContextFrame, type LockToken } from './context/index.js';
// Task board with DAG validation and idempotency
export {
  CircularDependencyError,
  DependencyNotFoundError,
  InMemoryTaskBoard,
  InvalidStatusTransitionError,
  TaskNotFoundError,
  createInMemoryTaskBoard
} from './task-board/in-memory.js';
export type { ITaskBoard, Task, TaskAttempt, TaskStatus, ToolCallRecord } from './task-board/types.js';
// Governance policies and enforcement
export type {
  ApprovalRule,
  AuditConfig,
  AuditEvent,
  AuditSink,
  BudgetProfile,
  EscalationRule,
  GovernancePolicy,
  Role,
  ToolAccessRule
} from './governance/policy.js';
export { PolicyEnforcer, evaluateCondition } from './governance/policy.js';
// Intelligence: task decomposition and cost estimation
export {
  CostEstimator,
  type CostEstimateResult,
  type TierCostModel,
  TIER_COST_MODELS
} from './intelligence/cost-estimator.js';
export {
  TaskDecomposer,
  type DecomposedTask,
  type DecomposerHeuristics,
  type DecomposedTaskTier
} from './intelligence/decomposer.js';
// Hook system
export { compileHooks, HookRegistry } from './hooks/index.js';
export type {
  ConflictStrategy,
  ConflictWarning,
  HookConflict,
  HookDefinition,
  HookExecutionPlan,
  HookPhase
} from './hooks/index.js';
export { HookPriority } from './hooks/index.js';
export {
  createGovernanceGate,
  createObservabilityHook,
  createRecoveryHook,
  createToolCallTracingHook
} from './hooks/index.js';
// Scheduler exports (consolidated from @agentsy/orchestrator/scheduler)
export * from './scheduler/index.js';
// Type definitions
export * from './types/index.js';
// Utilities
export * from './utils/matching.js';
export * from './utils/timing.js';
