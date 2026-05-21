import { eq } from 'drizzle-orm';

import type { MemoryDatabase } from '../../database/connection.js';
import { ragDocuments, ragVectors } from '../../database/schema.js';
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

interface DotAndNorms {
  dot: number;
  normA: number;
  normB: number;
}

function computeDotAndNorms(a: readonly number[], b: readonly number[], length: number): DotAndNorms {
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
  return { dot, normA, normB };
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  if (length <= 0) {
    return 0;
  }
  const { dot, normA, normB } = computeDotAndNorms(a, b, length);
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

function parseJsonNumberArray(value: string): number[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as number[];
    return [];
  } catch {
    return [];
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value === '{}' || value === '') {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function buildEvidence(
  record: HybridRecord,
  vectorScore: number,
  lexical: number,
  entity: number,
  temporal: number
): RAGEvidence {
  const final = vectorScore * 0.4 + lexical * 0.3 + entity * 0.2 + temporal * 0.1;

  return {
    citations: [
      {
        sourceId: record.sourceId,
        sourceType: record.sourceType,
        title: record.title
      }
    ],
    confidence: Math.max(0, Math.min(1, final)),
    content: record.content,
    id: record.id,
    score: final,
    scoreBreakdown: {
      entity,
      final,
      lexical,
      temporal,
      vector: vectorScore
    },
    sourceId: record.sourceId,
    sourceType: record.sourceType,
    title: record.title,
    updatedAt: record.updatedAt,
    ...(record.metadata === undefined ? {} : { metadata: { ...record.metadata } })
  };
}

export interface HybridRetriever {
  upsert(result: Omit<RAGSearchResult, 'score'>): void;
  remove(id: string): void;
  search(query: PlannedQuery): Promise<RAGEvidence[]>;
}

export interface HybridRetrieverOptions {
  db?: MemoryDatabase | undefined;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

function createInMemoryHybridRetriever(): HybridRetriever {
  const engine = createLocalEmbeddingEngine({ dimensions: 64 });
  const records = new Map<string, HybridRecord>();
  const vectors = new Map<string, number[]>();

  return {
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
          return buildEvidence(record, vectorScore, lexical, entity, temporal);
        })
        .toSorted((left, right) => right.score - left.score)
        .slice(0, Math.max(1, query.limit));
    },

    upsert(result) {
      const record: HybridRecord = {
        content: result.content,
        id: result.id,
        sourceId: result.sourceId,
        sourceType: result.sourceType,
        title: result.title,
        updatedAt: result.updatedAt,
        ...(result.metadata === undefined ? {} : { metadata: { ...result.metadata } })
      };
      records.set(record.id, record);
      vectors.set(record.id, engine.embed(`${record.title}\n${record.content}`));
    }
  };
}

// ---------------------------------------------------------------------------
// SQLite-backed implementation
// ---------------------------------------------------------------------------

function createSQLiteHybridRetriever(db: MemoryDatabase): HybridRetriever {
  const engine = createLocalEmbeddingEngine({ dimensions: 64 });

  function getRecordFromRow(row: { [key: string]: unknown }): HybridRecord {
    const updatedAtMs = Number(row.updatedAt);
    const metadata = parseMetadata(String(row.metadata));

    return {
      id: String(row.id),
      sourceId: String(row.sourceId),
      sourceType: String(row.sourceType) as HybridRecord['sourceType'],
      title: String(row.title),
      content: String(row.content),
      updatedAt: Number.isNaN(updatedAtMs) ? new Date().toISOString() : new Date(updatedAtMs).toISOString(),
      ...(metadata === undefined ? {} : { metadata })
    };
  }

  function getVectorFromRow(row: { [key: string]: unknown }): number[] {
    return parseJsonNumberArray(String(row.embedding));
  }

  return {
    remove(id) {
      db.delete(ragVectors).where(eq(ragVectors.docId, id)).run();
    },

    async search(query) {
      const now = new Date();
      const queryVector = engine.embed(query.query);
      const queryTerms = query.expandedTerms.length > 0 ? query.expandedTerms : query.query.toLowerCase().split(/\s+/u);

      const docRows = db.select().from(ragDocuments).all();
      const vectorRows = db.select().from(ragVectors).all();
      const vectorMap = new Map<string, number[]>();
      for (const row of vectorRows) {
        vectorMap.set(String(row.docId), getVectorFromRow(row));
      }

      return docRows
        .map(row => {
          const record = getRecordFromRow(row);
          const vector = vectorMap.get(record.id) ?? [];
          const vectorScore = cosineSimilarity(queryVector, vector);
          const lexical = lexicalScore(queryTerms, `${record.title}\n${record.content}`);
          const entity = entityScore(query.entities, record.metadata);
          const temporal = temporalScore(record.updatedAt, now);
          return buildEvidence(record, vectorScore, lexical, entity, temporal);
        })
        .toSorted((left, right) => right.score - left.score)
        .slice(0, Math.max(1, query.limit));
    },

    upsert(result) {
      const embedding = engine.embed(`${result.title}\n${result.content}`);
      db.insert(ragVectors)
        .values({ docId: result.id, embedding: JSON.stringify(embedding) })
        .onConflictDoUpdate({
          target: ragVectors.docId,
          set: { embedding: JSON.stringify(embedding) }
        })
        .run();
    }
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHybridRetriever(options: HybridRetrieverOptions = {}): HybridRetriever {
  if (options.db) {
    return createSQLiteHybridRetriever(options.db);
  }
  return createInMemoryHybridRetriever();
}
