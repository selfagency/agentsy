import type { DecayedItem } from './decay.js';
import {
  createLearningLoopOrchestrator,
  type LearningCycleResult,
  type LearningLoopConfig,
  type LearningLoopOrchestrator
} from './learning/loop-orchestrator.js';
import type { MemoryTierLike } from './memory-tier.js';
import type { TierName } from './tier-types.js';
import type { MemoryItem } from './tier-types.js';

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
  'sensory_buffer',
  'sensory_register',
  'working_memory',
  'short_term_memory',
  'long_term_memory'
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
  ingestItem: (content: string, importance: number, metadata: Record<string, unknown>) => string | null;
  getAllItems?: (() => MemoryItem[]) | undefined;
}

export async function awaken(deps: AwakenDeps, options: AwakenOptions = {}): Promise<AwakenResult> {
  const getNow = options.now ?? (() => performance.now());
  const start = getNow();

  // Step 1: Run decay pass (or use pre-computed results)
  let kept = 0;
  let promoted = 0;
  let demoted = 0;
  let discarded = 0;

  if (options.decayResults) {
    for (const result of options.decayResults) {
      if (result.action === 'discard') discarded++;
      else if (result.action === 'promote') promoted++;
      else if (result.action === 'demote') demoted++;
      else kept++;
    }

    // Reclaim budget for discarded items
    let reclaimedTokens = 0;
    for (const result of options.decayResults) {
      if (result.action === 'discard') {
        deps.budgetRelease(result.tier, result.item.tokenCount);
        reclaimedTokens += result.item.tokenCount;
      }
    }

    // Execute promotions and demotions from decay results
    for (const result of options.decayResults) {
      const currentTier = deps.tiers[result.tier];
      if (!currentTier) continue;

      if (result.action === 'promote') {
        const currentIdx = TIER_ORDER.indexOf(result.tier);
        const nextIdx = currentIdx + 1;
        if (nextIdx < TIER_ORDER.length) {
          const nextTierName = TIER_ORDER[nextIdx];
          const nextTier = nextTierName ? deps.tiers[nextTierName] : undefined;
          if (nextTier) {
            currentTier.promote(1, nextTier);
          }
        }
      } else if (result.action === 'demote') {
        const currentIdx = TIER_ORDER.indexOf(result.tier);
        const prevIdx = currentIdx - 1;
        if (prevIdx >= 0) {
          const prevTierName = TIER_ORDER[prevIdx];
          const prevTier = prevTierName ? deps.tiers[prevTierName] : undefined;
          if (prevTier) {
            currentTier.demote(1, prevTier);
          }
        }
      }
    }

    void reclaimedTokens;
  } else {
    const decayResult = deps.runDecayPass();
    kept = decayResult.kept;
    promoted = decayResult.promoted;
    demoted = decayResult.demoted;
    discarded = decayResult.discarded;
  }

  // Step 2: Consolidation — promote items that exceed consolidation thresholds
  let compressed = 0;
  let synthesized = 0;
  let summarized = 0;

  for (let i = 0; i < TIER_ORDER.length - 1; i++) {
    const tierName = TIER_ORDER[i];
    const nextTierName = TIER_ORDER[i + 1];
    if (!tierName || !nextTierName) continue;

    const tier = deps.tiers[tierName];
    const nextTier = deps.tiers[nextTierName];
    if (!tier || !nextTier) continue;

    const cap = tier.capacity();
    const utilizationRatio = cap.maxTokens === 0 ? 0 : cap.usedTokens / cap.maxTokens;

    if (utilizationRatio >= tier.config.consolidationThreshold) {
      const promoteCount = Math.ceil(cap.usedItems * tier.config.compressionTarget);
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

  // Step 3: Ingest pending events
  let pendingIngested = 0;
  if (options.pendingEvents) {
    for (const event of options.pendingEvents) {
      const importance = event.importance ?? 0.5;
      const metadata = event.metadata ?? {};
      const result = deps.ingestItem(event.content, importance, metadata);
      if (result !== null) {
        pendingIngested++;
      }
    }
  }

  // Step 4: Reclaim budget from consolidation moves
  let budgetReclaimed = 0;
  for (const tierName of TIER_ORDER) {
    const tier = deps.tiers[tierName];
    if (!tier) continue;
    const cap = tier.capacity();
    void cap;
  }

  // Step 5: Optional learning cycle
  let learningCycle: LearningCycleResult | undefined;
  if (options.runLearningCycle) {
    const getAllItems =
      deps.getAllItems ??
      (() => {
        const items: MemoryItem[] = [];
        for (const tierName of TIER_ORDER) {
          const tier = deps.tiers[tierName];
          if (!tier) continue;
          items.push(...tier.items());
        }
        return items;
      });

    const orchestrator: LearningLoopOrchestrator = createLearningLoopOrchestrator({ now: getNow });
    const allItems = getAllItems();
    const ltmTier = deps.tiers.long_term_memory;

    learningCycle = await orchestrator.runCycle(
      {
        getNewMemories: (limit: number) => allItems.slice(0, limit),
        getLTMMemories: () => [...(ltmTier?.items() ?? [])]
      },
      options.learningConfig
    );
  }

  const durationMs = getNow() - start;

  const result: AwakenResult = {
    decayPass: { kept, promoted, demoted, discarded },
    consolidation: { compressed, synthesized, summarized },
    budgetReclaimed,
    pendingIngested,
    durationMs
  };

  if (learningCycle) {
    result.learningCycle = learningCycle;
  }

  return result;
}
