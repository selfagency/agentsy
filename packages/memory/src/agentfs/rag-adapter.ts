import { eq, like } from 'drizzle-orm';

import type { MemoryDatabase } from '../database/connection.js';
import { kvStore } from '../database/schema.js';
import { createDocumentIngestor } from '../retrieval/rag/document-ingest.js';
import type { KnowledgeBaseManager } from '../retrieval/rag/knowledge-base.js';
import { createQueryPlanner } from '../retrieval/rag/query-planner.js';
import { rerankResults } from '../retrieval/rag/reranker.js';
import { sanitizeIngestSource } from '../retrieval/rag/sanitization.js';
import type {
  IngestSource,
  IngestSummary,
  RAGWeightConfig,
  RAGEvidence,
  RAGServerDocument
} from '../retrieval/rag/types.js';
import { createLocalEmbeddingEngine } from '../wiki/local-embedding-engine.js';

export interface RagFsAdapterOptions {
  db: MemoryDatabase;
  namespace?: string | undefined;
}

function makeDocKey(namespace: string, docId: string): string {
  return `rag:${namespace}:doc:${docId}`;
}

function makeVectorKey(namespace: string, docId: string): string {
  return `rag:${namespace}:vector:${docId}`;
}

function parseDoc(value: string): RAGServerDocument {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return {
    id: String(parsed.id),
    sourceId: String(parsed.sourceId),
    sourceType: String(parsed.sourceType) as RAGServerDocument['sourceType'],
    title: String(parsed.title),
    content: String(parsed.content),
    chunkIndex: Number(parsed.chunkIndex),
    updatedAt: String(parsed.updatedAt),
    ...(parsed.metadata === undefined ? {} : { metadata: parsed.metadata as Record<string, unknown> })
  };
}

function serializeDoc(doc: RAGServerDocument): string {
  return JSON.stringify(doc);
}

function parseVector(value: string): number[] {
  return JSON.parse(value) as number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
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
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalScore(queryTerms: string[], text: string): number {
  if (queryTerms.length === 0) return 0;
  const lowered = text.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (lowered.includes(term)) hits++;
  }
  return hits / queryTerms.length;
}

function temporalScore(updatedAtIso: string): number {
  const updatedAtMs = Date.parse(updatedAtIso);
  if (Number.isNaN(updatedAtMs)) return 0;
  const ageHours = Math.max(0, Date.now() - updatedAtMs) / (1000 * 60 * 60);
  return 1 / (1 + ageHours / 24);
}

/**
 * Create a KnowledgeBaseManager adapter backed by AgentFS `kv_store`.
 * Stores documents and their embeddings as JSON values keyed under
 * `rag:{namespace}:doc:{id}` and `rag:{namespace}:vector:{id}`.
 */
export function createRagFsAdapter(options: RagFsAdapterOptions): KnowledgeBaseManager {
  const { db, namespace = 'default' } = options;
  const docPrefix = `rag:${namespace}:doc:`;
  const engine = createLocalEmbeddingEngine({ dimensions: 64 });
  const planner = createQueryPlanner();

  function readAllDocs(): RAGServerDocument[] {
    const rows = db
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(like(kvStore.key, `${docPrefix}%`))
      .all();

    const docs: RAGServerDocument[] = [];
    for (const row of rows) {
      try {
        docs.push(parseDoc(row.value));
      } catch {
        // skip malformed
      }
    }
    return docs;
  }

  function readAllVectors(): Map<string, number[]> {
    const rows = db
      .select({ key: kvStore.key, value: kvStore.value })
      .from(kvStore)
      .where(like(kvStore.key, `rag:${namespace}:vector:%`))
      .all();

    const map = new Map<string, number[]>();
    for (const row of rows) {
      try {
        const docId = row.key.split(':').pop();
        if (docId) map.set(docId, parseVector(row.value));
      } catch {
        // skip malformed
      }
    }
    return map;
  }

  return {
    async ingest(source: IngestSource): Promise<IngestSummary> {
      const sanitized = sanitizeIngestSource(source);
      const ingestor = createDocumentIngestor();
      const output = await ingestor.ingest(sanitized);

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const doc of output.documents) {
        const existing = db
          .select({ value: kvStore.value })
          .from(kvStore)
          .where(eq(kvStore.key, makeDocKey(namespace, doc.id)))
          .get();

        if (!existing) {
          db.insert(kvStore)
            .values({
              key: makeDocKey(namespace, doc.id),
              value: serializeDoc(doc),
              updatedAt: Math.floor(Date.now() / 1000)
            })
            .run();
          inserted++;
        } else {
          const existingDoc = parseDoc(existing.value);
          if (existingDoc.content === doc.content && existingDoc.title === doc.title) {
            skipped++;
            continue;
          }
          db.insert(kvStore)
            .values({
              key: makeDocKey(namespace, doc.id),
              value: serializeDoc(doc),
              updatedAt: Math.floor(Date.now() / 1000)
            })
            .onConflictDoUpdate({
              target: kvStore.key,
              set: { value: serializeDoc(doc), updatedAt: Math.floor(Date.now() / 1000) }
            })
            .run();
          updated++;
        }

        // Compute and store embedding
        const embedding = engine.embed(`${doc.title}\n${doc.content}`);
        db.insert(kvStore)
          .values({
            key: makeVectorKey(namespace, doc.id),
            value: JSON.stringify(embedding),
            updatedAt: Math.floor(Date.now() / 1000)
          })
          .onConflictDoUpdate({
            target: kvStore.key,
            set: { value: JSON.stringify(embedding), updatedAt: Math.floor(Date.now() / 1000) }
          })
          .run();
      }

      return { inserted, updated, skipped };
    },

    async remove(documentId: string): Promise<boolean> {
      const docExists = db
        .select({ key: kvStore.key })
        .from(kvStore)
        .where(eq(kvStore.key, makeDocKey(namespace, documentId)))
        .get();

      if (!docExists) return false;

      db.delete(kvStore)
        .where(eq(kvStore.key, makeDocKey(namespace, documentId)))
        .run();
      db.delete(kvStore)
        .where(eq(kvStore.key, makeVectorKey(namespace, documentId)))
        .run();
      return true;
    },

    async search(input: {
      query: string;
      scope?: string;
      limit?: number;
      weights: RAGWeightConfig;
    }): Promise<RAGEvidence[]> {
      const planned = planner.plan({
        query: input.query,
        ...(input.scope === undefined ? {} : { scope: input.scope }),
        ...(input.limit === undefined ? {} : { limit: input.limit })
      });

      const docs = readAllDocs();
      const vectors = readAllVectors();
      const queryVector = engine.embed(input.query);
      const queryTerms =
        planned.expandedTerms.length > 0
          ? planned.expandedTerms
          : input.query.toLowerCase().split(/\s+/u).filter(Boolean);

      const results: RAGEvidence[] = docs.map(doc => {
        const vector = vectors.get(doc.id) ?? [];
        const vectorScore = cosineSimilarity(queryVector, vector);
        const lexical = lexicalScore(queryTerms, `${doc.title}\n${doc.content}`);
        const temporal = temporalScore(doc.updatedAt);

        // Simple entity score: no metadata entities in basic adapter
        const entity = 0;

        const final = vectorScore * 0.4 + lexical * 0.3 + entity * 0.2 + temporal * 0.1;

        return {
          id: doc.id,
          sourceId: doc.sourceId,
          sourceType: doc.sourceType,
          title: doc.title,
          content: doc.content,
          score: final,
          confidence: Math.max(0, Math.min(1, final)),
          updatedAt: doc.updatedAt,
          scoreBreakdown: {
            vector: vectorScore,
            lexical,
            entity,
            temporal,
            final
          },
          citations: [
            {
              sourceId: doc.sourceId,
              sourceType: doc.sourceType,
              title: doc.title,
              chunkIndex: doc.chunkIndex
            }
          ],
          ...(doc.metadata === undefined ? {} : { metadata: { ...doc.metadata } })
        };
      });

      results.sort((a, b) => b.score - a.score);
      const limited = results.slice(0, Math.max(1, planned.limit));
      return rerankResults(limited, input.weights);
    }
  };
}
