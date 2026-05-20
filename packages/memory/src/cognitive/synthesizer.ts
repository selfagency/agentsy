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
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function createSynthesizer(options: SynthesizerOptions = {}): Synthesizer {
  const now = options.now ?? (() => performance.now());
  const embeddingEngine = options.embeddingEngine ?? createLocalEmbeddingEngine();
  const similarityThreshold = options.similarityThreshold ?? 0.4;
  const entityExtractor = createEntityExtractor();

  return {
    synthesize(items: MemoryItem[], budget: number): SynthesizeResult {
      if (items.length === 0) {
        return { synthesized: [], sources: [], discarded: [], tokenReduction: 0 };
      }

      const firstItem = items[0];
      if (items.length === 1 && firstItem) {
        return { synthesized: [firstItem], sources: [firstItem.id], discarded: [], tokenReduction: 0 };
      }

      const currentNow = now();
      const embeddings = items.map(item => ({
        item,
        embedding: embeddingEngine.embed(item.content)
      }));

      // Group items by similarity
      const assigned = new Set<number>();
      const groups: { items: MemoryItem[]; indices: number[] }[] = [];

      for (let i = 0; i < items.length; i++) {
        if (assigned.has(i)) continue;

        const groupItem = items[i];
        if (!groupItem) continue;

        const group: { items: MemoryItem[]; indices: number[] } = {
          items: [groupItem],
          indices: [i]
        };
        assigned.add(i);

        const embeddingI = embeddings[i]?.embedding;
        if (!embeddingI) continue;

        for (let j = i + 1; j < items.length; j++) {
          if (assigned.has(j)) continue;

          const embeddingJ = embeddings[j]?.embedding;
          if (!embeddingJ) continue;

          const sim = cosineSimilarity(embeddingI, embeddingJ);

          if (sim >= similarityThreshold) {
            const jItem = items[j];
            if (jItem) {
              group.items.push(jItem);
              group.indices.push(j);
              assigned.add(j);
            }
          }
        }

        groups.push(group);
      }

      // Synthesize each group
      const synthesized: MemoryItem[] = [];
      const allSourceIds: string[] = [];
      const discarded: MemoryItem[] = [];
      let usedTokens = 0;
      let originalTokens = 0;

      for (const item of items) {
        originalTokens += item.tokenCount;
      }

      for (const group of groups) {
        const mergedContent = group.items.map(i => i.content).join('\n');

        const tokenCount = estimateTokens(mergedContent);

        if (usedTokens + tokenCount > budget) {
          // Keep highest-importance item from group, discard rest
          const sorted = [...group.items].sort((a, b) => b.importance - a.importance);
          const kept = sorted[0];
          if (kept) {
            discarded.push(...sorted.slice(1));
            const keptTokens = estimateTokens(kept.content);
            if (usedTokens + keptTokens <= budget) {
              synthesized.push(kept);
              allSourceIds.push(kept.id);
              usedTokens += keptTokens;
            } else {
              discarded.push(kept);
            }
          }
          continue;
        }

        const sourceIds = group.items.map(i => i.id);
        const maxImportance = Math.max(...group.items.map(i => i.importance));
        const extraction = entityExtractor.extract(mergedContent);

        const firstGroupItem = group.items[0];
        if (!firstGroupItem) continue;

        const merged: MemoryItem = {
          id: `synth-${firstGroupItem.id}`,
          kind: 'semantic',
          content: mergedContent,
          tokenCount,
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

        synthesized.push(merged);
        allSourceIds.push(...sourceIds);
        usedTokens += tokenCount;
      }

      const tokenReduction = originalTokens === 0 ? 0 : (originalTokens - usedTokens) / originalTokens;

      return { synthesized, sources: allSourceIds, discarded, tokenReduction };
    }
  };
}
