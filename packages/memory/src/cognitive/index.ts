// Cognitive tier engine — Phase 1
export type {
  MemoryItem,
  MemoryKind,
  ReuseClass,
  TierConfig,
  TierLevel,
  TierName,
  TierReadQuery,
  TierReadResult,
  WriteHeap
} from './tier-types.js';
export { TIER_LEVELS, TIER_NAMES } from './tier-types.js';

export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export { createMemoryTier, nextTierName, prevTierName } from './memory-tier.js';

export { createSensoryBuffer, type SensoryBufferOptions } from './sensory-buffer.js';
export { createSensoryRegister, type SensoryRegisterOptions } from './sensory-register.js';
export { createWorkingMemory, type WorkingMemoryOptions } from './working-memory.js';
export { createShortTermMemory, type ShortTermMemoryOptions } from './short-term-memory.js';
export { createLongTermMemory, type LongTermMemoryOptions } from './long-term-memory.js';

export {
  createTierBridge,
  createTierBridgeWithData,
  type TierBridge,
  type TierBridgeOptions,
  type TierBridgeWithDataOptions,
  type TierTransform
} from './tier-bridge.js';

// Phase 2 — Processing pipeline
export { createCompressor, type Compressor, type CompressResult, type CompressorOptions } from './compressor.js';
export { createSynthesizer, type Synthesizer, type SynthesizeResult, type SynthesizerOptions } from './synthesizer.js';
export {
  createSummarizer,
  type Summarizer,
  type SummarizeResult,
  type SummarizerOptions,
  type MetaAction
} from './summarizer.js';

// Phase 3 — Confidence scoring & decay
export {
  computeImportance,
  computeImportanceForItems,
  DEFAULT_IMPORTANCE_FACTORS,
  type ImportanceFactors
} from './importance.js';
export { applyDecay, applyDecayToAllTiers, DEFAULT_DECAY_CONFIG, type DecayConfig, type DecayedItem } from './decay.js';
export {
  createTierScheduler,
  type TierScheduler,
  type TierSchedulerOptions,
  type DecayPassResult
} from './tier-scheduler.js';

// Phase 4 — Token budget, awaken, MemoryEngine orchestrator
export {
  createTokenBudget,
  type TokenBudget,
  type TokenBudgetAllocation,
  type TokenBudgetOptions,
  type TokenBudgetSnapshot,
  type TierBudget
} from './token-budget.js';
export { awaken, type AwakenResult, type AwakenOptions, type PendingEvent, type AwakenDeps } from './awaken.js';
export {
  createMemoryEngine,
  type MemoryEngine,
  type MemoryEngineOptions,
  type MemoryEngineIngestOptions,
  type MemoryEngineRecallOptions,
  type MemoryEngineSnapshot,
  type MemoryEngineStats
} from './memory-engine.js';

// Phase 5 — Persona Memory & Knowledge Graph
export {
  createPersonaStore,
  type PersonaStore,
  type PersonaStoreOptions,
  type PersonaMemory,
  type PersonaAttribute,
  type PersonaPatch,
  type CommunicationProfile
} from './persona/persona-store.js';
export {
  createKnowledgeGraph,
  createGraphBuilder,
  type KnowledgeGraph,
  type KnowledgeGraphOptions,
  type GraphBuilder,
  type GraphBuilderOptions,
  type GraphNode,
  type GraphEdge,
  type Subgraph
} from './knowledge/graph-builder.js';

// Phase 6 — Learning Loop (Reflection, Dialectic & Solidification)
export * from './learning/index.js';

export {
  createTierTestClock,
  createTestMemoryItem,
  resetTestItemIdCounter,
  type TierTestClock,
  type TestMemoryItemOptions
} from './testing.js';
