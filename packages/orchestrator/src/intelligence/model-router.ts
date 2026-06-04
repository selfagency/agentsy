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
 */

import type { GatewayClient, ModelEntry, ModelTier, TierAwareModelSelector } from '@agentsy/gateway';

import type { WorkflowNode } from '../types/workflow.js';

export type { ModelEntry, ModelTier } from '@agentsy/gateway';

/**
 * Task tier. Direct alias for `ModelTier` — the orchestrator uses
 * the same tier vocabulary as the gateway. A task's tier is assigned
 * by the planner/decomposer based on complexity and risk.
 */
export type TaskTier = ModelTier;

/**
 * Router that selects a `ModelEntry` for a given task and tier.
 * Encapsulates the call to the gateway's `TierAwareModelSelector`.
 */
export interface TierAwareModelRouter {
  chooseModelForTask(input: { node: WorkflowNode; taskTier: TaskTier }): Promise<ModelEntry>;
}

/**
 * Default implementation that delegates to the gateway's model
 * selector. Infers the use case from the workflow node type/name.
 */
export class GatewayBackedModelRouter implements TierAwareModelRouter {
  readonly #selector: TierAwareModelSelector;

  constructor(gateway: GatewayClient) {
    this.#selector = gateway.getModelSelector();
  }

  async chooseModelForTask(input: { node: WorkflowNode; taskTier: TaskTier }): Promise<ModelEntry> {
    const useCase = inferUseCaseFromNode(input.node);

    const model = await this.#selector.selectModelForTier({
      tier: input.taskTier,
      useCase
    });
    return model;
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
