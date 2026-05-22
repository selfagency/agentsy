import type { KnowledgeBaseManager } from '../../retrieval/rag/knowledge-base.js';
import type { WikiManager } from '../../wiki/wiki-manager.js';
import type { MemoryItem } from '../tier-types.js';
import { createCanaryDetector, type CanaryDetector, type CanaryResult } from './canary-detector.js';
import {
  createConsolidationSpecialist,
  type ConsolidationResult,
  type ConsolidationSpecialist,
  type SpecialistRole
} from './consolidation-specialist.js';
import {
  createDialecticResolver,
  type DialecticResolver,
  type Resolution,
  type ResolutionPriority
} from './dialectic-resolver.js';
import { createObservationExtractor, type Observation, type ObservationExtractor } from './observation-extractor.js';
import {
  createSolidifier,
  type SolidificationCandidate,
  type SolidificationResult,
  type Solidifier,
  type SolidifierOptions
} from './solidifier.js';

export interface LearningLoopConfig {
  observation: {
    extractors: ('factual' | 'emotional' | 'procedural' | 'corrective' | 'relational')[];
    batchSize: number;
  };
  dialectic: {
    priorityRules: ResolutionPriority;
  };
  consolidation: {
    specialists: SpecialistRole[];
    maxTokenBudgetPerCycle: number;
    /** Validate consolidated facts against wiki before solidifying. */
    wikiValidation?: boolean | undefined;
  };
  solidification: SolidifierOptions;
  canary: {
    staleThreshold: number;
    degradationThreshold: number;
    checkInterval: number;
    /** Compare LTM against wiki for staleness. */
    wikiComparison?: boolean | undefined;
  };
  /** Auto-generate or update wiki pages with novel consolidated facts. */
  autoWikiUpdates?: boolean | undefined;
}

export interface LearningCycleResult {
  observationsExtracted: number;
  contradictionsFound: number;
  resolutionsProduced: number;
  consolidationsProduced: number;
  solidificationActions: SolidificationResult[];
  canaryActions: CanaryResult[];
  durationMs: number;
  /** Wiki pages created or updated during the cycle. */
  wikiUpdates?: { pageId: string; action: 'created' | 'updated' }[];
}

export interface LearningLoopDeps {
  getNewMemories(limit: number): MemoryItem[];
  getLTMMemories(): MemoryItem[];
  emitEvent?: ((event: { type: string; payload: Record<string, unknown> }) => void) | undefined;
  wiki?: WikiManager | undefined;
  knowledgeBase?: KnowledgeBaseManager | undefined;
}

export interface LearningLoopOrchestrator {
  runCycle(deps: LearningLoopDeps, config?: Partial<LearningLoopConfig>): Promise<LearningCycleResult>;
}

export interface LearningLoopOrchestratorOptions {
  now?: (() => number) | undefined;
}

export const DEFAULT_LEARNING_CONFIG: LearningLoopConfig = {
  observation: {
    extractors: ['factual', 'emotional', 'procedural', 'corrective', 'relational'],
    batchSize: 50
  },
  dialectic: {
    priorityRules: {
      sourceWeights: { event: 0.8, doc: 0.6, query: 0.4, ref: 0.3 },
      recencyBias: 0.5,
      confidenceThreshold: 0.3
    }
  },
  consolidation: {
    specialists: ['deduction', 'induction', 'surprisal', 'temporal'],
    maxTokenBudgetPerCycle: 2_000,
    wikiValidation: false
  },
  solidification: {
    promotionThreshold: 0.75,
    demotionThreshold: 0.3,
    mergeSimilarityThreshold: 0.85,
    archiveAccessThreshold: 2,
    maxAgeBeforeArchive: 30 * 24 * 60 * 60 * 1_000,
    minAgeForDemotion: 7 * 24 * 60 * 60 * 1_000
  },
  canary: {
    staleThreshold: 7 * 24 * 60 * 60 * 1_000,
    degradationThreshold: 0.4,
    checkInterval: 60 * 60 * 1_000,
    wikiComparison: false
  },
  autoWikiUpdates: false
};

export function createLearningLoopOrchestrator(
  options: LearningLoopOrchestratorOptions = {}
): LearningLoopOrchestrator {
  const now = options.now ?? (() => performance.now());

  const observationExtractor: ObservationExtractor = createObservationExtractor({ now });
  const dialecticResolver: DialecticResolver = createDialecticResolver({ now });
  const consolidationSpecialist: ConsolidationSpecialist = createConsolidationSpecialist({ now });
  const solidifier: Solidifier = createSolidifier({ now });
  const canaryDetector: CanaryDetector = createCanaryDetector({ now });

  async function runCycle(deps: LearningLoopDeps, config?: Partial<LearningLoopConfig>): Promise<LearningCycleResult> {
    const start = now();
    const mergedConfig = { ...DEFAULT_LEARNING_CONFIG, ...config };

    // 1. Observe
    const newMemories = deps.getNewMemories(mergedConfig.observation.batchSize);
    const observations: Observation[] = observationExtractor.extractBatch(newMemories);
    const allowedKinds = new Set(mergedConfig.observation.extractors);
    const filteredObs = observations.filter(o => allowedKinds.has(o.kind));

    if (deps.emitEvent) {
      deps.emitEvent({
        type: 'learning:observations',
        payload: { count: filteredObs.length }
      });
    }

    // 2. Dialectic
    const contradictions = dialecticResolver.detectContradictions(filteredObs);
    const resolutions: Resolution[] = dialecticResolver.resolve(contradictions, mergedConfig.dialectic.priorityRules);

    if (deps.emitEvent) {
      deps.emitEvent({
        type: 'learning:dialectic',
        payload: { contradictions: contradictions.length, resolutions: resolutions.length }
      });
    }

    // 3. Consolidate
    const consolidationResults: ConsolidationResult[] = [];
    for (const role of mergedConfig.consolidation.specialists) {
      consolidationResults.push(await consolidationSpecialist.consolidate(role, filteredObs));
    }

    const merged = await consolidationSpecialist.merge(consolidationResults);

    if (deps.emitEvent) {
      deps.emitEvent({
        type: 'learning:consolidation',
        payload: {
          specialistCount: mergedConfig.consolidation.specialists.length,
          mergedConfidence: merged.finalConfidence
        }
      });
    }

    // 3b. Wiki validation and auto-updates
    const wikiUpdates: { pageId: string; action: 'created' | 'updated' }[] = [];

    if (merged.finalConfidence > 0.5 && deps.wiki !== undefined && merged !== undefined) {
      const wiki = deps.wiki;
      const shouldValidate = mergedConfig.consolidation.wikiValidation ?? false;
      const shouldAutoUpdate = mergedConfig.autoWikiUpdates ?? false;

      if (shouldValidate || shouldAutoUpdate) {
        const queryTerms = merged.mergedSummary.split(/\s+/u).slice(0, 5).join(' ');
        const searchResults = await wiki.searchFullText(queryTerms, 5);
        const firstResult = searchResults[0];
        const matchingPage = firstResult !== undefined ? await wiki.getPage(firstResult.pageId) : null;

        let coverage: number | undefined;

        if (shouldValidate && matchingPage !== null) {
          const pageText = `${matchingPage.title} ${matchingPage.body}`.toLowerCase();
          const summaryText = merged.mergedSummary.toLowerCase();
          const overlap = summaryText.split(/\s+/u).filter(term => pageText.includes(term)).length;
          coverage = summaryText.split(/\s+/u).length > 0 ? overlap / summaryText.split(/\s+/u).length : 0;

          if (deps.emitEvent) {
            deps.emitEvent({
              type: 'learning:wiki_validation',
              payload: {
                pageId: matchingPage.pageId,
                coverage,
                confidence: merged.finalConfidence
              }
            });
          }
        }

        if (shouldAutoUpdate && matchingPage === null) {
          const topic = merged.mergedSummary.split(/[:.!?]/u)[0]?.trim() ?? 'Consolidated Fact';
          const pageId = topic
            .toLowerCase()
            .replace(/[^a-z0-9]+/gu, '-')
            .replace(/^-|-$/gu, '');

          if (pageId.length > 0) {
            try {
              await wiki.upsertPage({
                pageId,
                title: topic,
                body: merged.mergedSummary,
                tags: ['auto-generated', 'learning'],
                format: 'markdown',
                actorId: 'learning-loop'
              });
              wikiUpdates.push({ pageId, action: 'created' });
            } catch {
              // Gracefully skip wiki update on error
            }
          }
        } else if (shouldAutoUpdate && matchingPage !== null && coverage !== undefined && coverage < 0.5) {
          const pageId = matchingPage.pageId;
          try {
            await wiki.updatePage(
              pageId,
              { body: `${matchingPage.body}\n\n## Update\n${merged.mergedSummary}` },
              'learning-loop'
            );
            wikiUpdates.push({ pageId, action: 'updated' });
          } catch {
            // Gracefully skip wiki update on error
          }
        }
      }
    }

    // 4. Solidify
    const ltmMemories = deps.getLTMMemories();
    const solidificationCandidates: SolidificationCandidate[] = [];

    if (merged.finalConfidence > 0) {
      const existingInLTM = ltmMemories.some(
        m => m.content.slice(0, 60).toLowerCase() === merged.mergedSummary.slice(0, 60).toLowerCase()
      );

      solidificationCandidates.push({
        consolidation: merged,
        currentImportance: merged.finalConfidence,
        accessCount: 0,
        ageMs: 0,
        existingInLTM
      });
    }

    const solidificationActions: SolidificationResult[] = solidifier.evaluateBatch(solidificationCandidates);

    if (deps.emitEvent) {
      deps.emitEvent({
        type: 'learning:solidify',
        payload: { actions: solidificationActions.length }
      });
    }

    // 5. Canary
    const canaryActions: CanaryResult[] = canaryDetector.checkBatch(ltmMemories, filteredObs);

    if (deps.emitEvent) {
      deps.emitEvent({
        type: 'learning:canary',
        payload: { checks: canaryActions.length }
      });
    }

    const durationMs = now() - start;

    return {
      observationsExtracted: filteredObs.length,
      contradictionsFound: contradictions.length,
      resolutionsProduced: resolutions.length,
      consolidationsProduced: merged.specialistResults.length,
      solidificationActions,
      canaryActions,
      durationMs,
      ...(wikiUpdates.length > 0 ? { wikiUpdates } : {})
    };
  }

  return { runCycle };
}
