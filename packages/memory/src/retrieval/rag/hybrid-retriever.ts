import { createLocalEmbeddingEngine } from '../../wiki/local-embedding-engine.js';

import type { PlannedQuery, RAGEvidence, RAGSearchResult } from './types.js';

interface HybridRecord {
  id: string;
  sourceId: string;
  sourceType: RAGEvidence['sourceType'];
  title: string;
  content: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  if (length <= 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    const valueA = a[index] ?? 0;
    const valueB = b[index] ?? 0;
    dot += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalScore(queryTerms: readonly string[], text: string): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const lowered = text.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (lowered.includes(term)) {
      hits += 1;
    }
  }

  return hits / queryTerms.length;
}

function entityScore(entities: readonly string[], metadata: Record<string, unknown> | undefined): number {
  const raw = metadata?.entities;
  if (!Array.isArray(raw) || entities.length === 0) {
    return 0;
  }

  const normalized = raw.filter((value): value is string => typeof value === 'string').map(item => item.toLowerCase());
  if (normalized.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const entity of entities) {
    if (normalized.includes(entity.toLowerCase())) {
      hits += 1;
    }
  }

  return hits / entities.length;
}

function temporalScore(updatedAtIso: string, now: Date): number {
  const updatedAtMs = Date.parse(updatedAtIso);
  if (Number.isNaN(updatedAtMs)) {
    return 0;
  }

  const ageHours = Math.max(0, now.getTime() - updatedAtMs) / (1000 * 60 * 60);
  return 1 / (1 + ageHours / 24);
}

export interface HybridRetriever {
  upsert(result: Omit<RAGSearchResult, 'score'>): void;
  remove(id: string): void;
  search(query: PlannedQuery): Promise<RAGEvidence[]>;
}

export function createHybridRetriever(): HybridRetriever {
  const engine = createLocalEmbeddingEngine({ dimensions: 64 });
  const records = new Map<string, HybridRecord>();
  const vectors = new Map<string, number[]>();

  return {
    upsert(result) {
      const record: HybridRecord = {
        id: result.id,
        sourceId: result.sourceId,
        sourceType: result.sourceType,
        title: result.title,
        content: result.content,
        updatedAt: result.updatedAt,
        ...(result.metadata === undefined ? {} : { metadata: { ...result.metadata } })
      };
      records.set(record.id, record);
      vectors.set(record.id, engine.embed(`${record.title}\n${record.content}`));
    },

    remove(id) {
      records.delete(id);
      vectors.delete(id);
    },

    async search(query) {
      const now = new Date();
      const queryVector = engine.embed(query.query);
      const queryTerms = query.expandedTerms.length > 0 ? query.expandedTerms : query.query.toLowerCase().split(/\s+/u);

      return [...records.values()]
        .map(record => {
          const vector = vectors.get(record.id) ?? [];
          const vectorScore = cosineSimilarity(queryVector, vector);
          const lexical = lexicalScore(queryTerms, `${record.title}\n${record.content}`);
          const entity = entityScore(query.entities, record.metadata);
          const temporal = temporalScore(record.updatedAt, now);
          const final = vectorScore * 0.4 + lexical * 0.3 + entity * 0.2 + temporal * 0.1;

          const evidence: RAGEvidence = {
            id: record.id,
            sourceId: record.sourceId,
            sourceType: record.sourceType,
            title: record.title,
            content: record.content,
            score: final,
            confidence: Math.max(0, Math.min(1, final)),
            updatedAt: record.updatedAt,
            scoreBreakdown: {
              vector: vectorScore,
              lexical,
              entity,
              temporal,
              final
            },
            citations: [
              {
                sourceId: record.sourceId,
                sourceType: record.sourceType,
                title: record.title
              }
            ],
            ...(record.metadata === undefined ? {} : { metadata: { ...record.metadata } })
          };

          return evidence;
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, Math.max(1, query.limit));
    }
  };
}
