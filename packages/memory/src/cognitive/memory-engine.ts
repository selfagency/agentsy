import { fingerprintContent } from '../content-addressing/fingerprint.js';
import type { PubSubManager } from '../coordination/pub-sub-manager.js';
import type { Scheduler } from '../coordination/scheduler.js';
import { awaken, type AwakenResult, type PendingEvent } from './awaken.js';
import { createCompressor, type CompressorOptions } from './compressor.js';
import { type DecayConfig, DEFAULT_DECAY_CONFIG } from './decay.js';
import { computeImportance, DEFAULT_IMPORTANCE_FACTORS, type ImportanceFactors } from './importance.js';
import { createLongTermMemory, type LongTermMemoryOptions } from './long-term-memory.js';
import type { MemoryTierLike } from './memory-tier.js';
import { createSensoryBuffer, type SensoryBufferOptions } from './sensory-buffer.js';
import { createSensoryRegister, type SensoryRegisterOptions } from './sensory-register.js';
import { createShortTermMemory, type ShortTermMemoryOptions } from './short-term-memory.js';
import { createSummarizer, type SummarizerOptions } from './summarizer.js';
import { createSynthesizer, type SynthesizerOptions } from './synthesizer.js';
import { createTierScheduler, type TierScheduler, type TierSchedulerOptions } from './tier-scheduler.js';
import type { MemoryItem, MemoryKind, TierName, TierReadQuery, TierReadResult, WriteHeap } from './tier-types.js';
import {
  createTokenBudget,
  type TokenBudget,
  type TokenBudgetOptions,
  type TokenBudgetSnapshot
} from './token-budget.js';
import { createWorkingMemory, type WorkingMemoryOptions } from './working-memory.js';

export interface MemoryEngineIngestOptions {
  kind?: MemoryKind;
  writeHeap?: WriteHeap;
  importance?: number;
  metadata?: Record<string, unknown>;
  targetTier?: TierName;
}

export interface MemoryEngineRecallOptions extends TierReadQuery {
  tiers?: TierName[];
  crossTier?: boolean;
}

export interface MemoryEngineSnapshot {
  tiers: Record<TierName, { items: number; usedTokens: number; maxTokens: number }>;
  budget: TokenBudgetSnapshot;
  schedulerRunning: boolean;
}

export interface MemoryEngineStats {
  totalItems: number;
  totalTokens: number;
  tierStats: Record<
    TierName,
    {
      items: number;
      usedTokens: number;
      maxTokens: number;
      utilization: number;
    }
  >;
  budgetUtilization: number;
}

export interface MemoryEngineOptions {
  sensoryBuffer?: SensoryBufferOptions;
  sensoryRegister?: SensoryRegisterOptions;
  workingMemory?: WorkingMemoryOptions;
  shortTermMemory?: ShortTermMemoryOptions;
  longTermMemory?: LongTermMemoryOptions;
  budget?: Partial<TokenBudgetOptions>;
  importanceFactors?: ImportanceFactors;
  decayConfig?: DecayConfig;
  scheduler?: TierSchedulerOptions;
  compressor?: CompressorOptions;
  synthesizer?: SynthesizerOptions;
  summarizer?: SummarizerOptions;
  coordination?: {
    scheduler?: Scheduler;
    pubsub?: PubSubManager;
  };
  now?: (() => number) | undefined;
}

export interface MemoryEngine {
  ingest(content: string, options?: MemoryEngineIngestOptions): string | null;
  recall(query?: MemoryEngineRecallOptions): TierReadResult[];
  awaken(pendingEvents?: PendingEvent[]): Promise<AwakenResult>;
  snapshot(): MemoryEngineSnapshot;
  stats(): MemoryEngineStats;
  reset(): void;
  readonly tiers: Partial<Record<TierName, MemoryTierLike>>;
  readonly budget: TokenBudget;
  readonly scheduler: TierScheduler;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildBudgetOptions(options: MemoryEngineOptions): TokenBudgetOptions {
  const budgetOpts: TokenBudgetOptions = {
    budgets: options.budget?.budgets ?? {}
  };
  if (options.budget?.overprovisionFactor !== undefined) {
    budgetOpts.overprovisionFactor = options.budget.overprovisionFactor;
  }
  return budgetOpts;
}

function buildSchedulerOptions(options: MemoryEngineOptions): TierSchedulerOptions {
  const schedulerOpts: TierSchedulerOptions = {
    decayConfig: options.decayConfig ?? DEFAULT_DECAY_CONFIG,
    now: options.now ?? (() => performance.now())
  };
  if (options.scheduler?.intervalMs !== undefined) {
    schedulerOpts.intervalMs = options.scheduler.intervalMs;
  }
  if (options.scheduler?.decayConfig !== undefined) {
    schedulerOpts.decayConfig = options.scheduler.decayConfig;
  }
  if (options.coordination?.scheduler !== undefined) {
    schedulerOpts.scheduler = options.coordination.scheduler;
  }
  if (options.coordination?.pubsub !== undefined) {
    schedulerOpts.pubsub = options.coordination.pubsub;
  }
  return schedulerOpts;
}

function buildReadQuery(query: MemoryEngineRecallOptions): TierReadQuery {
  const readQuery: TierReadQuery = {};
  if (query.minImportance !== undefined) readQuery.minImportance = query.minImportance;
  if (query.kind !== undefined) readQuery.kind = query.kind;
  if (query.writeHeap !== undefined) readQuery.writeHeap = query.writeHeap;
  if (query.limit !== undefined) readQuery.limit = query.limit;
  return readQuery;
}

function getAllItemsFromTiers(tiers: Partial<Record<TierName, MemoryTierLike | undefined>>): MemoryItem[] {
  const items: MemoryItem[] = [];
  for (const tier of Object.values(tiers)) {
    if (!tier) continue;
    items.push(...tier.items());
  }
  return items;
}

export function createMemoryEngine(options: MemoryEngineOptions = {}): MemoryEngine {
  const now = options.now ?? (() => performance.now());
  const importanceFactors = options.importanceFactors ?? DEFAULT_IMPORTANCE_FACTORS;

  // Create tiers
  const sensoryBuffer = createSensoryBuffer({ ...options.sensoryBuffer, now });
  const sensoryRegister = createSensoryRegister({
    ...options.sensoryRegister,
    now
  });
  const workingMemory = createWorkingMemory({ ...options.workingMemory, now });
  const shortTermMemory = createShortTermMemory({
    ...options.shortTermMemory,
    now
  });
  const longTermMemory = createLongTermMemory({
    ...options.longTermMemory,
    now
  });

  const tiers: Partial<Record<TierName, MemoryTierLike>> = {
    sensory_buffer: sensoryBuffer,
    sensory_register: sensoryRegister,
    working_memory: workingMemory,
    short_term_memory: shortTermMemory,
    long_term_memory: longTermMemory
  };

  const budget = createTokenBudget(buildBudgetOptions(options));
  const scheduler = createTierScheduler(tiers, buildSchedulerOptions(options));

  // Create processing pipeline (used in tier bridges — Phase 5+)
  const _compressor = createCompressor({ ...options.compressor, now });
  const _synthesizer = createSynthesizer({ ...options.synthesizer, now });
  const _summarizer = createSummarizer({ ...options.summarizer, now });

  // Pending events queue for awaken
  const pendingEvents: PendingEvent[] = [];

  let itemIdSeq = 0;
  function nextItemId(): string {
    itemIdSeq++;
    return `mem-${itemIdSeq}`;
  }

  function buildMemoryItem(
    content: string,
    options: MemoryEngineIngestOptions,
    currentNow: number,
    tokenCount: number
  ): MemoryItem {
    const fp = fingerprintContent(content);
    const item: MemoryItem = {
      id: nextItemId(),
      kind: options.kind ?? 'episodic',
      content,
      tokenCount,
      importance: options.importance ?? 0.5,
      writeHeap: options.writeHeap ?? 'event',
      reuseClass: 'hot',
      createdAt: currentNow,
      lastAccessedAt: currentNow,
      accessCount: 0,
      fingerprint: fp.value,
      metadata: options.metadata ?? {}
    };
    item.importance = computeImportance(item, importanceFactors, currentNow);
    return item;
  }

  function handleWriteFailure(targetTierName: TierName, tokenCount: number, item: MemoryItem): null {
    budget.release(targetTierName, tokenCount);
    pendingEvents.push({
      content: item.content,
      importance: item.importance,
      metadata: item.metadata
    });
    return null;
  }

  function ingest(content: string, ingestOptions: MemoryEngineIngestOptions = {}): string | null {
    const targetTierName = ingestOptions.targetTier ?? 'sensory_buffer';
    const targetTier = tiers[targetTierName];

    if (!targetTier) return null;

    const tokenCount = estimateTokens(content);
    const allocation = budget.allocate(targetTierName, tokenCount);
    if (!allocation.granted) return null;

    const item = buildMemoryItem(content, ingestOptions, now(), tokenCount);
    const written = targetTier.write(item);
    if (written === null) {
      return handleWriteFailure(targetTierName, tokenCount, item);
    }

    return written.id;
  }

  function recall(query: MemoryEngineRecallOptions = {}): TierReadResult[] {
    const targetTiers =
      query.tiers ??
      (['sensory_buffer', 'sensory_register', 'working_memory', 'short_term_memory', 'long_term_memory'] as TierName[]);
    const crossTier = query.crossTier ?? true;
    const readQuery = buildReadQuery(query);

    if (crossTier) {
      let allItems: MemoryItem[] = [];

      for (const tierName of targetTiers) {
        const tier = tiers[tierName];
        if (!tier) continue;
        const result = tier.read(readQuery);
        allItems.push(...result.items);
      }

      allItems.sort((a, b) => b.importance - a.importance);

      if (query.limit !== undefined) {
        allItems = allItems.slice(0, query.limit);
      }

      const finalTokens = allItems.reduce((sum, i) => sum + i.tokenCount, 0);
      return [
        {
          items: allItems,
          tierName: 'sensory_buffer' as TierName,
          tokenCount: finalTokens,
          overflowed: query.limit !== undefined && allItems.length > query.limit
        }
      ];
    }

    const results: TierReadResult[] = [];
    for (const tierName of targetTiers) {
      const tier = tiers[tierName];
      if (!tier) continue;
      results.push(tier.read(readQuery));
    }
    return results;
  }

  async function doAwaken(events?: PendingEvent[]): Promise<AwakenResult> {
    const allPending = [...pendingEvents, ...(events ?? [])];
    pendingEvents.length = 0;

    return await awaken(
      {
        tiers,
        runDecayPass: () => scheduler.runDecayPass(),
        budgetRelease: (tier: TierName, tokens: number) => budget.release(tier, tokens),
        ingestItem: (content: string, importance: number, metadata: Record<string, unknown>) =>
          ingest(content, { importance, metadata }),
        getAllItems: () => getAllItemsFromTiers(tiers)
      },
      {
        pendingEvents: allPending,
        now
      }
    );
  }

  function takeSnapshot(): MemoryEngineSnapshot {
    const tierData = {} as Record<TierName, { items: number; usedTokens: number; maxTokens: number }>;
    for (const [name, tier] of Object.entries(tiers) as [TierName, MemoryTierLike | undefined][]) {
      if (!tier) continue;
      const cap = tier.capacity();
      tierData[name] = {
        items: cap.usedItems,
        usedTokens: cap.usedTokens,
        maxTokens: cap.maxTokens
      };
    }

    return {
      tiers: tierData,
      budget: budget.snapshot(),
      schedulerRunning: scheduler.isRunning()
    };
  }

  function getStats(): MemoryEngineStats {
    let totalItems = 0;
    let totalTokens = 0;
    const tierStats = {} as Record<
      TierName,
      {
        items: number;
        usedTokens: number;
        maxTokens: number;
        utilization: number;
      }
    >;

    for (const [name, tier] of Object.entries(tiers) as [TierName, MemoryTierLike | undefined][]) {
      if (!tier) continue;
      const cap = tier.capacity();
      totalItems += cap.usedItems;
      totalTokens += cap.usedTokens;
      tierStats[name] = {
        items: cap.usedItems,
        usedTokens: cap.usedTokens,
        maxTokens: cap.maxTokens,
        utilization: cap.maxTokens === 0 ? 0 : cap.usedTokens / cap.maxTokens
      };
    }

    const budgetSnap = budget.snapshot();

    return {
      totalItems,
      totalTokens,
      tierStats,
      budgetUtilization: budgetSnap.utilizationRatio
    };
  }

  function doReset(): void {
    for (const tier of Object.values(tiers) as (MemoryTierLike | undefined)[]) {
      tier?.clear();
    }
    budget.reset();
    pendingEvents.length = 0;
    itemIdSeq = 0;
    if (scheduler.isRunning()) {
      scheduler.stop();
    }
  }

  return {
    ingest,
    recall,
    awaken: doAwaken,
    snapshot: takeSnapshot,
    stats: getStats,
    reset: doReset,
    get tiers() {
      return tiers;
    },
    get budget() {
      return budget;
    },
    get scheduler() {
      return scheduler;
    }
  };
}
