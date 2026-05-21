import { createEntityExtractor } from '../wiki/entity-extractor.js';
import { createLocalEmbeddingEngine, type LocalEmbeddingEngine } from '../wiki/local-embedding-engine.js';
import type { MemoryItem } from './tier-types.js';

export interface Synthesizer {
  synthesize(items: MemoryItem[], budget: number): SynthesizeResult;
}

export interface SynthesizeResult {
  synthesized: MemoryItem[];
  sources: string[];
  discarded: MemoryItem[];
  tokenReduction: number;
}

export interface SynthesizerOptions {
  now?: (() => number) | undefined;
  embeddingEngine?: LocalEmbeddingEngine;
  similarityThreshold?: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    // nosemgrep: numeric array index verified by loop bounds
    const ai = a[i];
    // nosemgrep: numeric array index verified by loop bounds
    const bi = b[i];
    const aiVal = ai ?? 0;
    const biVal = bi ?? 0;
    dot += aiVal * biVal;
    normA += aiVal * aiVal;
    normB += biVal * biVal;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

type Group = { items: MemoryItem[]; indices: number[] };
type ItemEmbedding = { item: MemoryItem; embedding: number[] };
type BudgetState = {
  synthesized: MemoryItem[];
  allSourceIds: string[];
  discarded: MemoryItem[];
  usedTokens: number;
};

function prepareEmbeddings(items: MemoryItem[], embedFn: (text: string) => number[]): ItemEmbedding[] {
  return items.map(item => ({ item, embedding: embedFn(item.content) }));
}

function tryAddToGroup(
  group: Group,
  assigned: Set<number>,
  items: MemoryItem[],
  embeddings: ItemEmbedding[],
  threshold: number,
  i: number,
  j: number
): void {
  if (assigned.has(j)) return;

  // nosemgrep: j is verified as valid index before calling this function
  const embeddingJ = embeddings[j];
  if (!embeddingJ?.embedding) return;

  // nosemgrep: i is from loop index, verified against items.length
  const embeddingI = embeddings[i];
  if (!embeddingI?.embedding) return;

  const sim = cosineSimilarity(embeddingI.embedding, embeddingJ.embedding);
  if (sim < threshold) return;

  // nosemgrep: j is verified as valid index before calling this function
  const jItem = items[j];
  if (!jItem) return;

  group.items.push(jItem);
  group.indices.push(j);
  assigned.add(j);
}

function groupBySimilarity(items: MemoryItem[], embeddings: ItemEmbedding[], threshold: number): Group[] {
  const assigned = new Set<number>();
  const groups: Group[] = [];

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;

    const groupItem = items[i];
    if (!groupItem) continue;

    const group: Group = { items: [groupItem], indices: [i] };
    assigned.add(i);

    const embeddingI = embeddings[i];
    if (!embeddingI?.embedding) {
      groups.push(group);
      continue;
    }

    for (let j = i + 1; j < items.length; j++) {
      tryAddToGroup(group, assigned, items, embeddings, threshold, i, j);
    }

    groups.push(group);
  }

  return groups;
}

function handleBudgetOverflow(group: Group, budgetRemaining: number, state: BudgetState): void {
  const sorted = [...group.items].sort((a, b) => b.importance - a.importance);
  const kept = sorted[0];
  if (!kept) return;

  state.discarded.push(...sorted.slice(1));
  const keptTokens = estimateTokens(kept.content);
  if (keptTokens <= budgetRemaining) {
    state.synthesized.push(kept);
    state.allSourceIds.push(kept.id);
    state.usedTokens += keptTokens;
  } else {
    state.discarded.push(kept);
  }
}

function mergeGroup(
  group: Group,
  currentNow: number,
  entityExtractor: {
    extract: (text: string) => {
      entities: unknown[];
      relationships: unknown[];
    };
  }
): MemoryItem {
  const mergedContent = group.items.map(i => i.content).join('\n');
  const sourceIds = group.items.map(i => i.id);
  const maxImportance = Math.max(...group.items.map(i => i.importance));
  const extraction = entityExtractor.extract(mergedContent);
  const firstGroupItem = group.items[0];
  if (firstGroupItem === undefined) {
    throw new Error('Cannot synthesize empty group');
  }

  return {
    id: `synth-${firstGroupItem.id}`,
    kind: 'semantic',
    content: mergedContent,
    tokenCount: estimateTokens(mergedContent),
    importance: Math.min(1, maxImportance + 0.1),
    writeHeap: 'event',
    reuseClass: 'warm',
    createdAt: firstGroupItem.createdAt,
    lastAccessedAt: currentNow,
    accessCount: group.items.reduce((sum, i) => sum + i.accessCount, 0),
    fingerprint: `synth-${group.items.map(i => i.fingerprint).join('+')}`,
    metadata: {
      sourceIds,
      entityCount: extraction.entities.length,
      relationshipCount: extraction.relationships.length,
      _synthesized: true
    }
  };
}

function synthesizeGroups(
  groups: Group[],
  budget: number,
  currentNow: number,
  entityExtractor: {
    extract: (text: string) => {
      entities: unknown[];
      relationships: unknown[];
    };
  },
  originalTokens: number
): SynthesizeResult {
  const state: BudgetState = {
    synthesized: [],
    allSourceIds: [],
    discarded: [],
    usedTokens: 0
  };

  for (const group of groups) {
    const merged = mergeGroup(group, currentNow, entityExtractor);

    if (state.usedTokens + merged.tokenCount > budget) {
      handleBudgetOverflow(group, budget - state.usedTokens, state);
      continue;
    }

    state.synthesized.push(merged);
    state.allSourceIds.push(...group.items.map(i => i.id));
    state.usedTokens += merged.tokenCount;
  }

  const tokenReduction = originalTokens === 0 ? 0 : (originalTokens - state.usedTokens) / originalTokens;

  return {
    synthesized: state.synthesized,
    sources: state.allSourceIds,
    discarded: state.discarded,
    tokenReduction
  };
}

export function createSynthesizer(options: SynthesizerOptions = {}): Synthesizer {
  const now = options.now ?? (() => performance.now());
  const embeddingEngine = options.embeddingEngine ?? createLocalEmbeddingEngine();
  const similarityThreshold = options.similarityThreshold ?? 0.4;
  const entityExtractor = createEntityExtractor();

  return {
    synthesize(items: MemoryItem[], budget: number): SynthesizeResult {
      if (items.length === 0) {
        return {
          synthesized: [],
          sources: [],
          discarded: [],
          tokenReduction: 0
        };
      }

      const firstItem = items[0];
      if (items.length === 1 && firstItem) {
        return {
          synthesized: [firstItem],
          sources: [firstItem.id],
          discarded: [],
          tokenReduction: 0
        };
      }

      const currentNow = now();
      const embeddings = prepareEmbeddings(items, text => embeddingEngine.embed(text));
      const groups = groupBySimilarity(items, embeddings, similarityThreshold);
      const originalTokens = items.reduce((sum, item) => sum + item.tokenCount, 0);

      return synthesizeGroups(groups, budget, currentNow, entityExtractor, originalTokens);
    }
  };
}
