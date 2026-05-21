import type { DecayedItem } from "./decay.js";
import {
  createLearningLoopOrchestrator,
  type LearningCycleResult,
  type LearningLoopConfig,
  type LearningLoopOrchestrator,
} from "./learning/loop-orchestrator.js";
import type { MemoryTierLike } from "./memory-tier.js";
import type { TierName, MemoryItem } from "./tier-types.js";

export interface AwakenResult {
  decayPass: {
    kept: number;
    promoted: number;
    demoted: number;
    discarded: number;
  };
  consolidation: {
    compressed: number;
    synthesized: number;
    summarized: number;
  };
  budgetReclaimed: number;
  pendingIngested: number;
  durationMs: number;
  learningCycle?: LearningCycleResult;
}

export interface PendingEvent {
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface AwakenOptions {
  pendingEvents?: PendingEvent[];
  decayResults?: DecayedItem[];
  now?: () => number;
  runLearningCycle?: boolean;
  learningConfig?: Partial<LearningLoopConfig>;
}

const TIER_ORDER: TierName[] = [
  "sensory_buffer",
  "sensory_register",
  "working_memory",
  "short_term_memory",
  "long_term_memory",
];

export interface AwakenDeps {
  tiers: Partial<Record<TierName, MemoryTierLike>>;
  runDecayPass: () => {
    kept: number;
    promoted: number;
    demoted: number;
    discarded: number;
    durationMs: number;
  };
  budgetRelease: (tier: TierName, tokens: number) => void;
  ingestItem: (
    content: string,
    importance: number,
    metadata: Record<string, unknown>,
  ) => string | null;
  getAllItems?: (() => MemoryItem[]) | undefined;
}

interface DecayCounts {
  kept: number;
  promoted: number;
  demoted: number;
  discarded: number;
}

function countDecayActions(results: DecayedItem[]): DecayCounts {
  let kept = 0;
  let promoted = 0;
  let demoted = 0;
  let discarded = 0;

  for (const result of results) {
    if (result.action === "discard") discarded++;
    else if (result.action === "promote") promoted++;
    else if (result.action === "demote") demoted++;
    else kept++;
  }

  return { kept, promoted, demoted, discarded };
}

function reclaimBudgetForDiscarded(
  results: DecayedItem[],
  budgetRelease: AwakenDeps["budgetRelease"],
): void {
  for (const result of results) {
    if (result.action === "discard") {
      budgetRelease(result.tier, result.item.tokenCount);
    }
  }
}

function applyDecayMoves(
  results: DecayedItem[],
  tiers: AwakenDeps["tiers"],
): void {
  for (const result of results) {
    const currentTier = tiers[result.tier];
    if (!currentTier) continue;

    if (result.action === "promote") {
      const currentIdx = TIER_ORDER.indexOf(result.tier);
      const nextIdx = currentIdx + 1;
      if (nextIdx < TIER_ORDER.length) {
        const nextTierName = TIER_ORDER[nextIdx];
        const nextTier = nextTierName ? tiers[nextTierName] : undefined;
        if (nextTier) {
          currentTier.promote(1, nextTier);
        }
      }
    } else if (result.action === "demote") {
      const currentIdx = TIER_ORDER.indexOf(result.tier);
      const prevIdx = currentIdx - 1;
      if (prevIdx >= 0) {
        const prevTierName = TIER_ORDER[prevIdx];
        const prevTier = prevTierName ? tiers[prevTierName] : undefined;
        if (prevTier) {
          currentTier.demote(1, prevTier);
        }
      }
    }
  }
}

function runDecayStep(options: AwakenOptions, deps: AwakenDeps): DecayCounts {
  if (options.decayResults) {
    const counts = countDecayActions(options.decayResults);
    reclaimBudgetForDiscarded(options.decayResults, deps.budgetRelease);
    applyDecayMoves(options.decayResults, deps.tiers);
    return counts;
  }

  const result = deps.runDecayPass();
  return {
    kept: result.kept,
    promoted: result.promoted,
    demoted: result.demoted,
    discarded: result.discarded,
  };
}

interface ConsolidationCounts {
  compressed: number;
  synthesized: number;
  summarized: number;
}

function runConsolidationStep(tiers: AwakenDeps["tiers"]): ConsolidationCounts {
  let compressed = 0;
  let synthesized = 0;
  let summarized = 0;

  for (let i = 0; i < TIER_ORDER.length - 1; i++) {
    const tierName = TIER_ORDER[i];
    const nextTierName = TIER_ORDER[i + 1];
    if (!tierName || !nextTierName) continue;

    const tier = tiers[tierName];
    const nextTier = tiers[nextTierName];
    if (!tier || !nextTier) continue;

    const cap = tier.capacity();
    const utilizationRatio =
      cap.maxTokens === 0 ? 0 : cap.usedTokens / cap.maxTokens;

    if (utilizationRatio >= tier.config.consolidationThreshold) {
      const promoteCount = Math.ceil(
        cap.usedItems * tier.config.compressionTarget,
      );
      const actuallyPromoted = tier.promote(promoteCount, nextTier);
      if (i < 2) {
        compressed += actuallyPromoted;
      } else if (i < 3) {
        synthesized += actuallyPromoted;
      } else {
        summarized += actuallyPromoted;
      }
    }
  }

  return { compressed, synthesized, summarized };
}

function ingestPendingEvents(
  events: PendingEvent[],
  ingestItem: AwakenDeps["ingestItem"],
): number {
  let ingested = 0;
  for (const event of events) {
    const importance = event.importance ?? 0.5;
    const metadata = event.metadata ?? {};
    const result = ingestItem(event.content, importance, metadata);
    if (result !== null) {
      ingested++;
    }
  }
  return ingested;
}

function buildGetAllItems(tiers: AwakenDeps["tiers"]): () => MemoryItem[] {
  return () => {
    const items: MemoryItem[] = [];
    for (const tierName of TIER_ORDER) {
      const tier = tiers[tierName];
      if (!tier) continue;
      items.push(...tier.items());
    }
    return items;
  };
}

async function runLearningCycle(
  deps: AwakenDeps,
  options: AwakenOptions,
  getNow: () => number,
): Promise<LearningCycleResult | undefined> {
  if (!options.runLearningCycle) return undefined;

  const getAllItems = deps.getAllItems ?? buildGetAllItems(deps.tiers);
  const orchestrator: LearningLoopOrchestrator = createLearningLoopOrchestrator(
    { now: getNow },
  );
  const allItems = getAllItems();
  const ltmTier = deps.tiers.long_term_memory;

  return orchestrator.runCycle(
    {
      getNewMemories: (limit: number) => allItems.slice(0, limit),
      getLTMMemories: () => [...(ltmTier?.items() ?? [])],
    },
    options.learningConfig,
  );
}

export async function awaken(
  deps: AwakenDeps,
  options: AwakenOptions = {},
): Promise<AwakenResult> {
  const getNow = options.now ?? (() => performance.now());
  const start = getNow();

  const decayPass = runDecayStep(options, deps);
  const consolidation = runConsolidationStep(deps.tiers);
  const pendingIngested = options.pendingEvents
    ? ingestPendingEvents(options.pendingEvents, deps.ingestItem)
    : 0;

  const learningCycle = await runLearningCycle(deps, options, getNow);

  const durationMs = getNow() - start;

  return {
    decayPass,
    consolidation,
    budgetReclaimed: 0,
    pendingIngested,
    durationMs,
    ...(learningCycle ? { learningCycle } : {}),
  };
}
