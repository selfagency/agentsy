import { randomUUID } from 'node:crypto';

import { createContentProcessor, type ContentProcessor } from './content-processor.js';
import { createLocalEmbeddingEngine, type LocalEmbeddingEngine } from './local-embedding-engine.js';
import { createNavigationSystem, type NavigationSystem } from './navigation-system.js';
import { createVersionTracker, type VersionTracker } from './version-tracker.js';

export type RawSourceType = 'document' | 'conversation' | 'capture';

export interface RawCaptureInput {
  sourceId: string;
  sourceType: RawSourceType;
  content: string;
}

export interface RawCapture {
  id: string;
  sourceId: string;
  sourceType: RawSourceType;
  content: string;
  normalizedContent: string;
  createdAt: Date;
}

export interface WikiPageInput {
  pageId: string;
  title: string;
  body: string;
  tags?: string[];
  format?: 'markdown' | 'text' | 'code' | 'json';
  actorId?: string;
  writerIds?: string[];
}

export interface WikiPage {
  pageId: string;
  title: string;
  body: string;
  tags: string[];
  version: number;
  format: 'markdown' | 'text' | 'code' | 'json';
  writerIds: string[];
  updatedAt: Date;
}

export interface WikiPageHistoryEntry {
  version: number;
  body: string;
  actorId: string;
  editedAt: Date;
}

export interface PageDiff {
  addedLines: string[];
  removedLines: string[];
}

export interface ConceptRelation {
  toPageId: string;
  relation: string;
}

export interface VectorEntry {
  pageId: string;
  embedding: number[];
}

export interface VectorSearchResult {
  pageId: string;
  score: number;
}

export interface WikiManager {
  captureRaw(input: RawCaptureInput): Promise<RawCapture>;
  upsertPage(input: WikiPageInput): Promise<WikiPage>;
  getPage(pageId: string): Promise<WikiPage | null>;
  upsertVector(pageId: string, embedding: number[]): Promise<void>;
  searchVector(queryEmbedding: number[], limit: number): Promise<VectorSearchResult[]>;
  updatePage(
    pageId: string,
    patch: Partial<Pick<WikiPageInput, 'title' | 'body' | 'tags' | 'format'>>,
    actorId: string,
  ): Promise<WikiPage>;
  getPageHistory(pageId: string): Promise<WikiPageHistoryEntry[]>;
  diffPageVersions(pageId: string, fromVersion: number, toVersion: number): Promise<PageDiff>;
  searchFullText(query: string, limit: number): Promise<VectorSearchResult[]>;
  searchHybrid(query: string, queryEmbedding: number[], limit: number): Promise<VectorSearchResult[]>;
  extractEntities(pageId: string): Promise<string[]>;
  linkConcepts(fromPageId: string, toPageId: string, relation: string): Promise<void>;
  getConceptRelations(pageId: string): Promise<ConceptRelation[]>;
  linkPages(fromPageId: string, toPageId: string): Promise<void>;
  getBacklinks(pageId: string): Promise<string[]>;
}

export interface WikiManagerDependencies {
  contentProcessor?: ContentProcessor;
  embeddingEngine?: LocalEmbeddingEngine;
  versionTracker?: VersionTracker;
  navigation?: NavigationSystem;
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
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

export function createWikiManager(dependencies: WikiManagerDependencies = {}): WikiManager {
  const contentProcessor = dependencies.contentProcessor ?? createContentProcessor();
  const embeddingEngine = dependencies.embeddingEngine ?? createLocalEmbeddingEngine();
  const versionTracker = dependencies.versionTracker ?? createVersionTracker();
  const navigation = dependencies.navigation ?? createNavigationSystem();

  const rawCaptures = new Map<string, RawCapture>();
  const pages = new Map<string, WikiPage>();
  const vectors = new Map<string, VectorEntry>();
  const history = new Map<string, WikiPageHistoryEntry[]>();
  const concepts = new Map<string, ConceptRelation[]>();

  function toSearchResult(pageId: string, score: number): VectorSearchResult {
    return { pageId, score };
  }

  function scoreByFullText(query: string, page: WikiPage): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryTerms.length === 0) {
      return 0;
    }

    const searchable = `${page.title}\n${contentProcessor.toSearchableText(page.body)}`.toLowerCase();
    let hits = 0;

    for (const term of queryTerms) {
      if (searchable.includes(term)) {
        hits += 1;
      }
    }

    return hits / queryTerms.length;
  }

  function ensureCanWrite(page: WikiPage, actorId: string): void {
    if (page.writerIds.length === 0 || page.writerIds.includes(actorId)) {
      return;
    }

    throw new Error(`Actor ${actorId} does not have write access to ${page.pageId}`);
  }

  function getHistoryBody(pageId: string, version: number): string {
    const pageHistory = history.get(pageId) ?? [];
    const item = pageHistory.find(entry => entry.version === version);
    if (!item) {
      throw new Error(`Unknown version ${version} for page ${pageId}`);
    }

    return item.body;
  }

  return {
    async captureRaw(input: RawCaptureInput) {
      const capture: RawCapture = {
        id: randomUUID(),
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        content: input.content,
        normalizedContent: contentProcessor.normalize(input.content),
        createdAt: new Date(),
      };

      rawCaptures.set(capture.id, capture);
      return capture;
    },

    async upsertPage(input: WikiPageInput) {
      const version = versionTracker.bump(input.pageId);
      const actorId = input.actorId ?? 'system';
      const format = input.format ?? contentProcessor.detectFormat(input.body);
      const writerIds = [...(input.writerIds ?? [])];
      const page: WikiPage = {
        pageId: input.pageId,
        title: input.title,
        body: input.body,
        tags: [...(input.tags ?? [])],
        version,
        format,
        writerIds,
        updatedAt: new Date(),
      };

      pages.set(page.pageId, page);
      vectors.set(page.pageId, {
        pageId: page.pageId,
        embedding: embeddingEngine.embed(`${page.title}\n${contentProcessor.toSearchableText(page.body)}`),
      });

      const pageHistory = history.get(page.pageId) ?? [];
      pageHistory.push({
        version,
        body: page.body,
        actorId,
        editedAt: page.updatedAt,
      });
      history.set(page.pageId, pageHistory);

      return page;
    },

    async getPage(pageId: string) {
      const page = pages.get(pageId);
      return page
        ? {
            ...page,
            tags: [...page.tags],
            writerIds: [...page.writerIds],
          }
        : null;
    },

    async upsertVector(pageId: string, embedding: number[]) {
      vectors.set(pageId, {
        pageId,
        embedding: [...embedding],
      });
    },

    async searchVector(queryEmbedding: number[], limit: number) {
      const scored: VectorSearchResult[] = [...vectors.values()]
        .map(entry => ({
          pageId: entry.pageId,
          score: cosineSimilarity(queryEmbedding, entry.embedding),
        }))
        .sort((left, right) => right.score - left.score);

      return scored.slice(0, Math.max(0, limit));
    },

    async updatePage(pageId, patch, actorId) {
      const current = pages.get(pageId);
      if (!current) {
        throw new Error(`Unknown page ${pageId}`);
      }

      ensureCanWrite(current, actorId);

      const nextVersion = versionTracker.bump(pageId);
      const nextBody = patch.body ?? current.body;
      const nextPage: WikiPage = {
        ...current,
        ...(patch.title === undefined ? {} : { title: patch.title }),
        ...(patch.tags === undefined ? {} : { tags: [...patch.tags] }),
        body: nextBody,
        format: patch.format ?? current.format,
        version: nextVersion,
        updatedAt: new Date(),
      };

      pages.set(pageId, nextPage);
      vectors.set(pageId, {
        pageId,
        embedding: embeddingEngine.embed(`${nextPage.title}\n${contentProcessor.toSearchableText(nextPage.body)}`),
      });

      const pageHistory = history.get(pageId) ?? [];
      pageHistory.push({
        version: nextVersion,
        body: nextPage.body,
        actorId,
        editedAt: nextPage.updatedAt,
      });
      history.set(pageId, pageHistory);

      return {
        ...nextPage,
        tags: [...nextPage.tags],
        writerIds: [...nextPage.writerIds],
      };
    },

    async getPageHistory(pageId) {
      return [...(history.get(pageId) ?? [])].map(entry => ({ ...entry }));
    },

    async diffPageVersions(pageId, fromVersion, toVersion) {
      const fromBody = getHistoryBody(pageId, fromVersion);
      const toBody = getHistoryBody(pageId, toVersion);

      const fromLines = fromBody.split('\n');
      const toLines = toBody.split('\n');

      const fromSet = new Set(fromLines);
      const toSet = new Set(toLines);

      const addedLines = toLines.filter(line => !fromSet.has(line));
      const removedLines = fromLines.filter(line => !toSet.has(line));

      return { addedLines, removedLines };
    },

    async searchFullText(query, limit) {
      const scored = [...pages.values()]
        .map(page => toSearchResult(page.pageId, scoreByFullText(query, page)))
        .filter(item => item.score > 0)
        .sort((left, right) => right.score - left.score);

      return scored.slice(0, Math.max(0, limit));
    },

    async searchHybrid(query, queryEmbedding, limit) {
      const vectorScores = await this.searchVector(queryEmbedding, Number.MAX_SAFE_INTEGER);
      const vectorScoreMap = new Map<string, number>(vectorScores.map(item => [item.pageId, item.score]));

      const hybridScores = [...pages.values()]
        .map(page => {
          const textScore = scoreByFullText(query, page);
          const vectorScore = vectorScoreMap.get(page.pageId) ?? 0;
          const score = textScore * 0.5 + vectorScore * 0.5;
          return toSearchResult(page.pageId, score);
        })
        .filter(item => item.score > 0)
        .sort((left, right) => right.score - left.score);

      return hybridScores.slice(0, Math.max(0, limit));
    },

    async extractEntities(pageId) {
      const page = pages.get(pageId);
      if (!page) {
        return [];
      }

      return contentProcessor.extractEntities(`${page.title}\n${page.body}`);
    },

    async linkConcepts(fromPageId, toPageId, relation) {
      const existing = concepts.get(fromPageId) ?? [];
      existing.push({ toPageId, relation });
      concepts.set(fromPageId, existing);
    },

    async getConceptRelations(pageId) {
      return [...(concepts.get(pageId) ?? [])];
    },

    async linkPages(fromPageId: string, toPageId: string) {
      navigation.linkPages(fromPageId, toPageId);
    },

    async getBacklinks(pageId: string) {
      return navigation.getBacklinks(pageId);
    },
  };
}
