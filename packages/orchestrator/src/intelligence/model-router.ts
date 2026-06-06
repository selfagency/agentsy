/**
 * Model-tier routing adapter for the orchestrator.
 *
 * Task tiers map 1:1 to `ModelTier` from the gateway. The orchestrator
 * delegates ALL model selection to the gateway's `TierAwareModelSelector`
 * and never encodes its own cost tables or tier assignments.
 *
 * Architecture decision (2026-06-04):
 *   - Tiers are defined on `ModelEntry`, not `ProviderEntry`
 *   - Orchestrator uses `TaskTier = ModelTier` (re-exported from gateway)
 *   - All cost and capability data lives in the gateway's `ModelRegistry`
 *
 * Updated (2026-06-04, Phase 3.7):
 *   - Escalation policy is orchestrator-controlled (gateway does not decide)
 *   - Recovery flow: retry same model replica → spillover → escalate → pause
 */

import { getLogicalModel, spillover } from '@agentsy/gateway';
import type {
  GatewayClient,
  ModelEntry,
  ModelReplica,
  ModelSelectionConstraints,
  ModelTier,
  ReplicaRegistry,
  ReplicaSelectionContext,
  ReplicaSelector,
  TierAwareModelSelector
} from '@agentsy/gateway';

import type { WorkflowNode } from '../types/workflow.js';

import type { FailoverChain } from '../recovery/model-failover.js';
import { createFailoverChain as buildFailoverChain, ExhaustedError, getNextStep } from '../recovery/model-failover.js';

export type { ModelEntry, ModelTier } from '@agentsy/gateway';

/**
 * Task tier. Direct alias for `ModelTier` — the orchestrator uses
 * the same tier vocabulary as the gateway. A task's tier is assigned
 * by the planner/decomposer based on complexity and risk.
 */
export type TaskTier = ModelTier;

/**
 * Escalation policy — controls whether tier escalation is allowed
 * and what the escalation chain looks like.
 */
export interface EscalationPolicy {
  /** Whether to allow tier escalation when the current tier has no candidates. */
  allowEscalation: boolean;
  /** Custom escalation chain. Default: micro → small → mid → frontier. */
  chain?: ModelTier[];
  /** Max escalation steps. Default: 4 (full chain). */
  maxSteps?: number;
}

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  allowEscalation: true,
  chain: ['micro', 'small', 'mid', 'frontier'],
  maxSteps: 4
};

export const NO_ESCALATION_POLICY: EscalationPolicy = {
  allowEscalation: false
};

/**
 * Record of a single selection attempt — used for diagnostics and recovery.
 */
export interface SelectionRecord {
  attemptedAt: string;
  /** Whether escalation was triggered. */
  escalated: boolean;
  /** Replica ids that were tried and failed, in order. */
  failedReplicas: string[];
  logicalModelId: string;
  /** The selected logical model after all fallback. */
  selectedModel?: string;
  /** The selected replica id after all fallback. */
  selectedReplica?: string;
  taskTier: TaskTier;
}

// =============================================================================
// Router interface + options
// =============================================================================

export interface TierAwareModelRouterOptions {
  escalationPolicy?: EscalationPolicy;
  modelSelectionConstraints?: ModelSelectionConstraints;
  /** Optional replica registry for failover chain resolution. */
  replicaRegistry?: ReplicaRegistry;
  /** Optional replica selector for failover chain resolution. */
  replicaSelector?: ReplicaSelector;
}

/**
 * Router that selects a `ModelEntry` for a given task and tier.
 * Encapsulates the call to the gateway's `TierAwareModelSelector`.
 */
export interface TierAwareModelRouter {
  chooseModelForTask(input: { node: WorkflowNode; taskTier: TaskTier }): Promise<ModelEntry>;
  getSelectionRecord(): SelectionRecord | undefined;

  /**
   * Build a failover chain from the selected model and available replicas.
   * Returns a chain with steps ordered: same-replica-retry → next-replica
   * (same model) → next-model (same tier) → tier-escalation (if allowed).
   */
  createFailoverChain(selectedModel: ModelEntry): FailoverChain;

  /**
   * Advance the failover chain and resolve the next step to a `ModelEntry`.
   * Uses the gateway's spillover logic to pick the best replica for the step.
   * Throws `ExhaustedError` when no steps remain.
   *
   * @param chain - The failover chain (mutated in place).
   * @param error - The error from the last failed attempt.
   * @param context - Replica selection context for the spillover logic.
   */
  nextFailoverModel(chain: FailoverChain, error: Error, context: ReplicaSelectionContext): Promise<ModelEntry>;
}

/**
 * Default implementation that delegates to the gateway's model
 * selector. Infers the use case from the workflow node type/name.
 */
export class GatewayBackedModelRouter implements TierAwareModelRouter {
  readonly #selector: TierAwareModelSelector;
  readonly #options: {
    escalationPolicy: EscalationPolicy;
    modelSelectionConstraints: ModelSelectionConstraints;
  };
  readonly #replicaRegistry: ReplicaRegistry | undefined;
  readonly #replicaSelector: ReplicaSelector | undefined;
  /** Most recent selection record — overwritten on each `chooseModelForTask` call. */
  #record: SelectionRecord | undefined;

  constructor(gateway: GatewayClient, options: TierAwareModelRouterOptions = {}) {
    this.#selector = gateway.getModelSelector();
    this.#options = {
      escalationPolicy: options.escalationPolicy ?? DEFAULT_ESCALATION_POLICY,
      modelSelectionConstraints: options.modelSelectionConstraints ?? {}
    };
    this.#replicaRegistry = options.replicaRegistry;
    this.#replicaSelector = options.replicaSelector;
  }

  getSelectionRecord(): SelectionRecord | undefined {
    return this.#record;
  }

  async chooseModelForTask(input: { node: WorkflowNode; taskTier: TaskTier }): Promise<ModelEntry> {
    const useCase = inferUseCaseFromNode(input.node);

    const record: SelectionRecord = {
      attemptedAt: new Date().toISOString(),
      failedReplicas: [],
      escalated: false,
      logicalModelId: '',
      taskTier: input.taskTier
    };

    const constraints: ModelSelectionConstraints = {};
    const base = this.#options.modelSelectionConstraints;
    if (base.excludeProviders !== undefined) {
      constraints.excludeProviders = base.excludeProviders;
    }
    if (base.localPreference !== undefined) {
      constraints.localPreference = base.localPreference;
    }
    if (base.maxUsdPer1KInput !== undefined) {
      constraints.maxUsdPer1KInput = base.maxUsdPer1KInput;
    }
    if (base.maxUsdPer1KOutput !== undefined) {
      constraints.maxUsdPer1KOutput = base.maxUsdPer1KOutput;
    }
    if (base.minContextWindow !== undefined) {
      constraints.minContextWindow = base.minContextWindow;
    }
    if (base.requireJsonMode !== undefined) {
      constraints.requireJsonMode = base.requireJsonMode;
    }
    if (base.requireTools !== undefined) {
      constraints.requireTools = base.requireTools;
    }

    try {
      const model = await this.#selector.selectModelForTier({
        constraints,
        tier: this.#resolveTier(input.taskTier),
        useCase
      });

      record.logicalModelId = model.id;
      record.selectedModel = model.id;
      this.#record = record;
      return model;
    } catch (error) {
      record.escalated = true;
      this.#record = record;
      throw error;
    }
  }

  // ===========================================================================
  // Failover chain
  // ===========================================================================

  /**
   * Build a failover chain from the selected model and all replicas
   * available in the optional `ReplicaRegistry`. If no registry is
   * configured, returns an empty chain (no failover possible).
   */
  createFailoverChain(selectedModel: ModelEntry): FailoverChain {
    const replicas = this.#replicaRegistry?.getByLogicalModel(selectedModel.id) ?? [];

    // Also include replicas from other logical models in the same tier
    const allTierReplicas =
      this.#replicaRegistry?.getAll().filter(r => getLogicalModel(r.logicalModelId)?.tier === selectedModel.tier) ?? [];

    const allReplicas = [
      ...new Map<string, ModelReplica>([...replicas, ...allTierReplicas].map(r => [r.id, r] as const)).values()
    ];

    return buildFailoverChain(selectedModel, allReplicas, this.#options.escalationPolicy);
  }

  /**
   * Advance the failover chain and resolve the next step to a `ModelEntry`.
   * Uses the gateway's `spillover` function to find the best replica for the
   * step. Throws `ExhaustedError` when no steps remain.
   *
   * Recording: each failed attempt is appended to `SelectionRecord.failedReplicas`.
   */
  async nextFailoverModel(chain: FailoverChain, error: Error, context: ReplicaSelectionContext): Promise<ModelEntry> {
    const step = getNextStep(chain, error);
    if (step === undefined) {
      throw new ExhaustedError([...chain.steps], chain.currentStep);
    }

    // Validate we have the required gateway components
    if (this.#replicaRegistry === undefined || this.#replicaSelector === undefined) {
      throw new ExhaustedError([...chain.steps], chain.currentStep);
    }

    // Record the failed replica before trying the next step
    if (this.#record) {
      if (step.replicaId) {
        this.#record.failedReplicas.push(step.replicaId);
      }
    }

    // Use the gateway's spillover to resolve the step to a replica
    const logicalModelId = step.logicalModelId;
    const tier = step.tier ?? 'micro';

    const escalationTierChain = this.#options.escalationPolicy.chain;
    const spilloverResult = spillover(
      logicalModelId ?? '',
      tier,
      this.#replicaRegistry,
      this.#replicaSelector,
      context,
      {
        allowTierEscalation: this.#options.escalationPolicy.allowEscalation,
        ...(escalationTierChain !== undefined ? { escalationChain: escalationTierChain } : {}),
        excludeReplicas: new Set(this.#record?.failedReplicas)
      }
    );

    if (spilloverResult === undefined) {
      throw new ExhaustedError([...chain.steps], chain.currentStep);
    }

    // Convert the spillover result (ModelReplica) to a ModelEntry
    const modelEntry = this.#replicaToEntry(spilloverResult.replica);
    if (modelEntry === undefined) {
      throw new ExhaustedError([...chain.steps], chain.currentStep);
    }

    // Update selection record
    if (this.#record) {
      this.#record.selectedModel = modelEntry.id;
      this.#record.selectedReplica = spilloverResult.replica.id;
    }

    return modelEntry;
  }

  /**
   * Convert a `ModelReplica` to a `ModelEntry` by merging replica-specific
   * data with the canonical logical model definition from the gateway.
   */
  #replicaToEntry(replica: ModelReplica): ModelEntry | undefined {
    const logical = getLogicalModel(replica.logicalModelId);
    if (logical === undefined) {
      return;
    }

    return {
      id: replica.logicalModelId,
      modelName: replica.upstreamModelName,
      providerId: replica.providerId,
      tier: logical.tier,
      useCases: logical.useCases,
      capabilities: logical.capabilities,
      contextWindow: logical.contextWindow,
      maxOutputTokens: logical.maxOutputTokens,
      cost: replica.cost,
      isLocal: replica.isLocal
    };
  }

  /**
   * Resolve the effective tier to select from, based on escalation policy.
   * When escalation is allowed, the selector may return a model from any
   * tier in the chain starting from the assigned tier. When disabled, only
   * the assigned tier is considered.
   */
  #resolveTier(taskTier: TaskTier): TaskTier {
    if (!this.#options.escalationPolicy.allowEscalation) {
      return taskTier;
    }
    // When escalation is allowed, start from the assigned tier.
    // The gateway selector handles the actual escalation logic.
    return taskTier;
  }
}

const CODE_KEYWORDS = ['code', 'implement', 'write', 'compile', 'refactor', 'test'];
const SEARCH_KEYWORDS = ['search', 'research', 'find', 'retrieve', 'lookup'];
const EMBED_KEYWORDS = ['embed', 'vector', 'embedding'];

function inferUseCaseFromNode(node: WorkflowNode): 'chat' | 'code' | 'search' | 'embed' | 'vision' {
  const name = node.name?.toLowerCase() ?? '';
  const type = node.type;

  // Decision nodes are pure logic — use a cheap model
  if (type === 'decision') {
    return 'search';
  }

  if (CODE_KEYWORDS.some(kw => name.includes(kw))) {
    return 'code';
  }
  if (SEARCH_KEYWORDS.some(kw => name.includes(kw))) {
    return 'search';
  }
  if (EMBED_KEYWORDS.some(kw => name.includes(kw))) {
    return 'embed';
  }
  return 'chat';
}
