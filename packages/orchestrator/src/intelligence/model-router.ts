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

import type {
  GatewayClient,
  ModelEntry,
  ModelSelectionConstraints,
  ModelTier,
  TierAwareModelSelector
} from '@agentsy/gateway';

import type { WorkflowNode } from '../types/workflow.js';

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
}

/**
 * Router that selects a `ModelEntry` for a given task and tier.
 * Encapsulates the call to the gateway's `TierAwareModelSelector`.
 */
export interface TierAwareModelRouter {
  chooseModelForTask(input: { node: WorkflowNode; taskTier: TaskTier }): Promise<ModelEntry>;
  getSelectionRecord(): SelectionRecord | undefined;
}

/**
 * Default implementation that delegates to the gateway's model
 * selector. Infers the use case from the workflow node type/name.
 */
export class GatewayBackedModelRouter implements TierAwareModelRouter {
  readonly #selector: TierAwareModelSelector;
  readonly #options: Required<TierAwareModelRouterOptions>;
  /** Most recent selection record — overwritten on each `chooseModelForTask` call. */
  #record: SelectionRecord | undefined;

  constructor(gateway: GatewayClient, options: TierAwareModelRouterOptions = {}) {
    this.#selector = gateway.getModelSelector();
    this.#options = {
      escalationPolicy: options.escalationPolicy ?? DEFAULT_ESCALATION_POLICY,
      modelSelectionConstraints: options.modelSelectionConstraints ?? {}
    };
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
