import type { MemoryEngine, MemoryEngineRecallOptions } from './cognitive/memory-engine.js';
import type { TierName } from './cognitive/tier-types.js';
import type { KnowledgeBaseManager } from './retrieval/rag/knowledge-base.js';
import type { RAGEvidenceCitation } from './retrieval/rag/types.js';
import { createLocalEmbeddingEngine } from './wiki/local-embedding-engine.js';
import type { WikiManager } from './wiki/wiki-manager.js';

export interface UnifiedMemoryQuery {
  query: string;
  limit?: number;
  includeTiers?: TierName[] | false;
  includeWiki?: boolean;
  includeRAG?: boolean;
  minImportance?: number;
  weights?: {
    tierMemory: number;
    wiki: number;
    rag: number;
  };
}

export interface UnifiedMemoryResult {
  source: 'tier' | 'wiki' | 'rag';
  id: string;
  title?: string;
  content: string;
  score: number;
  tier?: TierName;
  pageId?: string;
  citations?: RAGEvidenceCitation[];
}

function getWeightForSource(
  source: UnifiedMemoryResult['source'],
  weights: NonNullable<UnifiedMemoryQuery['weights']>
): number {
  if (source === 'tier') return weights.tierMemory;
  return weights[source] ?? 0.3;
}

async function queryTiers(
  engine: MemoryEngine,
  query: UnifiedMemoryQuery,
  results: UnifiedMemoryResult[],
  limit: number
): Promise<void> {
  if (query.includeTiers === false) return;

  const recallOpts: MemoryEngineRecallOptions = {
    crossTier: false,
    minImportance: query.minImportance ?? 0.3,
    limit
  };
  if (Array.isArray(query.includeTiers) && query.includeTiers.length > 0) {
    recallOpts.tiers = query.includeTiers;
  }

  const tierResults = engine.recall(recallOpts);
  const q = query.query.toLowerCase();
  for (const tierResult of tierResults) {
    for (const item of tierResult.items) {
      if (item.content.toLowerCase().includes(q)) {
        results.push({
          source: 'tier',
          id: item.id,
          content: item.content,
          score: item.importance,
          tier: tierResult.tierName
        });
      }
    }
  }
}

async function queryWiki(
  wiki: WikiManager,
  query: UnifiedMemoryQuery,
  results: UnifiedMemoryResult[],
  limit: number
): Promise<void> {
  if (query.includeWiki === false) return;

  const embeddingEngine = createLocalEmbeddingEngine({ dimensions: 64 });
  const wikiResults = await wiki.searchHybrid(query.query, embeddingEngine.embed(query.query), limit);
  for (const wr of wikiResults) {
    const page = await wiki.getPage(wr.pageId);
    if (page) {
      results.push({
        source: 'wiki',
        id: wr.pageId,
        title: page.title,
        content: page.body.slice(0, 500),
        score: wr.score,
        pageId: wr.pageId
      });
    }
  }
}

async function queryRag(
  kb: KnowledgeBaseManager,
  query: UnifiedMemoryQuery,
  results: UnifiedMemoryResult[],
  limit: number
): Promise<void> {
  if (query.includeRAG === false) return;

  const ragResults = await kb.search({
    query: query.query,
    limit,
    weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
  });
  for (const rr of ragResults) {
    results.push({
      source: 'rag',
      id: rr.id,
      title: rr.title,
      content: rr.content,
      score: rr.score,
      citations: rr.citations
    });
  }
}

function rerankResults(
  results: UnifiedMemoryResult[],
  weights: NonNullable<UnifiedMemoryQuery['weights']>,
  limit: number
): UnifiedMemoryResult[] {
  results.sort((a, b) => {
    const wa = getWeightForSource(a.source, weights);
    const wb = getWeightForSource(b.source, weights);
    return b.score * wb - a.score * wa;
  });

  return results.slice(0, limit);
}

export async function queryUnified(
  engine: MemoryEngine,
  wiki: WikiManager,
  kb: KnowledgeBaseManager,
  query: UnifiedMemoryQuery
): Promise<UnifiedMemoryResult[]> {
  const results: UnifiedMemoryResult[] = [];
  const limit = query.limit ?? 10;

  await queryTiers(engine, query, results, limit);
  await queryWiki(wiki, query, results, limit);
  await queryRag(kb, query, results, limit);

  const weights = query.weights ?? { tierMemory: 0.3, wiki: 0.3, rag: 0.4 };
  return rerankResults(results, weights, limit);
}
