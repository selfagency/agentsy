// Cognitive tier engine — Phase 1

export {
  type AwakenDeps,
  type AwakenOptions,
  type AwakenResult,
  awaken,
  type PendingEvent
} from './awaken.js';
// Phase 2 — Processing pipeline
export {
  type Compressor,
  type CompressorOptions,
  type CompressResult,
  createCompressor
} from './compressor.js';
export {
  applyDecay,
  applyDecayToAllTiers,
  DEFAULT_DECAY_CONFIG,
  type DecayConfig,
  type DecayedItem
} from './decay.js';
// Phase 3 — Confidence scoring & decay
export {
  computeImportance,
  computeImportanceForItems,
  DEFAULT_IMPORTANCE_FACTORS,
  type ImportanceFactors
} from './importance.js';
export {
  createGraphBuilder,
  createKnowledgeGraph,
  type GraphBuilder,
  type GraphBuilderOptions,
  type GraphEdge,
  type GraphNode,
  type KnowledgeGraph,
  type KnowledgeGraphOptions,
  type Subgraph
} from './knowledge/graph-builder.js';
// Phase 6 — Learning Loop (Reflection, Dialectic & Solidification)
export * from './learning/index.js';
export { createLongTermMemory, type LongTermMemoryOptions } from './long-term-memory.js';
export {
  createMemoryEngine,
  type MemoryEngine,
  type MemoryEngineIngestOptions,
  type MemoryEngineOptions,
  type MemoryEngineRecallOptions,
  type MemoryEngineSnapshot,
  type MemoryEngineStats
} from './memory-engine.js';
export type { MemoryTierLike, MemoryTierOptions } from './memory-tier.js';
export { createMemoryTier, nextTierName, prevTierName } from './memory-tier.js';
// Phase 5 — Persona Memory & Knowledge Graph
export {
  type CommunicationProfile,
  createPersonaStore,
  type PersonaAttribute,
  type PersonaMemory,
  type PersonaPatch,
  type PersonaStore,
  type PersonaStoreOptions
} from './persona/persona-store.js';
export { createSensoryBuffer, type SensoryBufferOptions } from './sensory-buffer.js';
export { createSensoryRegister, type SensoryRegisterOptions } from './sensory-register.js';
export { createShortTermMemory, type ShortTermMemoryOptions } from './short-term-memory.js';
export {
  createSummarizer,
  type MetaAction,
  type SummarizeResult,
  type Summarizer,
  type SummarizerOptions
} from './summarizer.js';
export {
  createSynthesizer,
  type SynthesizeResult,
  type Synthesizer,
  type SynthesizerOptions
} from './synthesizer.js';
export {
  createTestMemoryItem,
  createTierTestClock,
  resetTestItemIdCounter,
  type TestMemoryItemOptions,
  type TierTestClock
} from './testing.js';
export {
  createTierBridge,
  createTierBridgeWithData,
  type TierBridge,
  type TierBridgeOptions,
  type TierBridgeWithDataOptions,
  type TierTransform
} from './tier-bridge.js';
export {
  createTierScheduler,
  type DecayPassResult,
  type TierScheduler,
  type TierSchedulerOptions
} from './tier-scheduler.js';
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
// Phase 4 — Token budget, awaken, MemoryEngine orchestrator
export {
  createTokenBudget,
  type TierBudget,
  type TokenBudget,
  type TokenBudgetAllocation,
  type TokenBudgetOptions,
  type TokenBudgetSnapshot
} from './token-budget.js';
export { createWorkingMemory, type WorkingMemoryOptions } from './working-memory.js';
