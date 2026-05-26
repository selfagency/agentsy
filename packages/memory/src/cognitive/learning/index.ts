// Phase 6 — Learning Loop: Reflection, Dialectic & Solidification

export {
  type CanaryCheck,
  type CanaryDetector,
  type CanaryDetectorOptions,
  type CanaryResult,
  createCanaryDetector
} from './canary-detector.js';
export {
  type ConsolidationResult,
  type ConsolidationSpecialist,
  type ConsolidationSpecialistOptions,
  createConsolidationSpecialist,
  type MergedConsolidation,
  type SpecialistProvider,
  type SpecialistRole
} from './consolidation-specialist.js';
export {
  createDialecticResolver,
  type DialecticResolver,
  type DialecticResolverOptions,
  type Representation,
  type RepresentationView,
  type Resolution,
  type ResolutionPriority
} from './dialectic-resolver.js';
export {
  createLearningLoopOrchestrator,
  DEFAULT_LEARNING_CONFIG,
  type LearningCycleResult,
  type LearningLoopConfig,
  type LearningLoopDeps,
  type LearningLoopOrchestrator,
  type LearningLoopOrchestratorOptions
} from './loop-orchestrator.js';
export {
  createObservationExtractor,
  type Observation,
  type ObservationExtractor,
  type ObservationExtractorOptions,
  type ObservationKind
} from './observation-extractor.js';
export {
  createSolidifier,
  DEFAULT_SOLIDIFIER_OPTIONS,
  type SolidificationCandidate,
  type SolidificationResult,
  type Solidifier,
  type SolidifierOptions
} from './solidifier.js';
