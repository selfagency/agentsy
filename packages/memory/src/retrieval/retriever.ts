import type { MemoryScope } from '../scope/scope-manager.js';
import { cosineSimilarity } from '../math-utils.js';
import type { LocalEmbeddingEngine } from '../wiki/local-embedding-engine.js';
import { createLocalEmbeddingEngine } from '../wiki/local-embedding-engine.js';

export interface MemorySearchRecord {
  content: string;
  createdAt: Date;
  id: string;
  scope: MemoryScope;
  tags?: string[];
  title?: string;
  updatedAt?: Date;
}

export interface MemorySearchHit {
  reasons: string[];
  record: MemorySearchRecord;
  score: number;
}

export interface MemorySearchInput {
  actorId?: string;
  limit?: number;
  now?: Date;
  query: string;
  scope?: MemoryScope;
}

export interface MemoryRetriever {
  list(): MemorySearchRecord[];
  remove(recordId: string): void;
  search(input: MemorySearchInput): Promise<MemorySearchHit[]>;
  upsert(record: MemorySearchRecord): void;
}

export interface MemoryRetrieverOptions {
  canReadScope?: (actorId: string, scope: MemoryScope) => boolean;
  embeddingEngine?: LocalEmbeddingEngine;
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function lexicalScore(queryTerms: string[], record: MemorySearchRecord): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const haystack = `${record.title ?? ''}\n${record.content}`.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      hits += 1;
    }
  }

  return hits / queryTerms.length;
}

function temporalScore(record: MemorySearchRecord, now: Date): number {
  const ageMs = Math.max(0, +now - +record.createdAt);
  const ageHours = ageMs / (1000 * 60 * 60);
  return 1 / (1 + ageHours / 24);
}

function weightedScore(semantic: number, lexical: number, temporal: number): number {
  return semantic * 0.45 + lexical * 0.4 + temporal * 0.15;
}

function cloneRecord(record: MemorySearchRecord): MemorySearchRecord {
  return {
    id: record.id,
    scope: record.scope,
    content: record.content,
    ...(record.title === undefined ? {} : { title: record.title }),
    ...(record.tags === undefined ? {} : { tags: [...record.tags] }),
    createdAt: new Date(record.createdAt),
    ...(record.updatedAt === undefined ? {} : { updatedAt: new Date(record.updatedAt) })
  };
}

export function createMemoryRetriever(options: MemoryRetrieverOptions = {}): MemoryRetriever {
  const embeddingEngine = options.embeddingEngine ?? createLocalEmbeddingEngine({ dimensions: 64 });
  const records = new Map<string, MemorySearchRecord>();
  const embeddings = new Map<string, number[]>();

  return {
    list() {
      return [...records.values()].map(cloneRecord);
    },

    remove(recordId) {
      records.delete(recordId);
      embeddings.delete(recordId);
    },

    // biome-ignore lint/suspicious/useAwait: Implements MemoryRetriever interface requiring Promise return
    async search(input) {
      const queryTerms = normalizeQueryTerms(input.query);
      const queryEmbedding = embeddingEngine.embed(input.query);
      const now = input.now ?? new Date();
      const limit = Math.max(1, input.limit ?? 8);

      const candidates = [...records.values()].filter(record => {
        if (input.scope && record.scope !== input.scope) {
          return false;
        }

        if (input.actorId && options.canReadScope && !options.canReadScope(input.actorId, record.scope)) {
          return false;
        }

        return true;
      });

      return candidates
        .map(record => {
          const embedding = embeddings.get(record.id) ?? [];
          const semantic = cosineSimilarity(queryEmbedding, embedding);
          const lexical = lexicalScore(queryTerms, record);
          const temporal = temporalScore(record, now);
          const score = weightedScore(semantic, lexical, temporal);

          const reasons = [
            `semantic:${semantic.toFixed(3)}`,
            `lexical:${lexical.toFixed(3)}`,
            `temporal:${temporal.toFixed(3)}`
          ];

          return {
            reasons,
            record: cloneRecord(record),
            score
          };
        })
        .toSorted((left, right) => right.score - left.score)
        .slice(0, limit);
    },

    upsert(record) {
      const normalized = cloneRecord(record);
      records.set(record.id, normalized);
      embeddings.set(record.id, embeddingEngine.embed(`${normalized.title ?? ''}\n${normalized.content}`));
    }
  };
}
