import { z } from 'zod';

import type { MemoryEngine, MemoryEngineIngestOptions, MemoryEngineRecallOptions } from '../cognitive/memory-engine.js';
import type { TierName } from '../cognitive/tier-types.js';
import type { KnowledgeBaseManager } from '../retrieval/rag/knowledge-base.js';
import { queryUnified, type UnifiedMemoryQuery } from '../unified-query.js';
import type { WikiManager } from '../wiki/wiki-manager.js';
import type { McpToolDefinition, McpToolHandler } from './protocol.js';

export interface MemoryMcpToolSet {
  definitions: Record<string, McpToolDefinition>;
  handlers: Record<string, McpToolHandler>;
}

const KIND_VALUES = ['semantic', 'episodic', 'procedural', 'sensory'] as const;

const TIER_NAMES = [
  'sensory_buffer',
  'sensory_register',
  'working_memory',
  'short_term_memory',
  'long_term_memory'
] as const satisfies readonly TierName[];

const SCOPE_VALUES = ['tiers', 'wiki', 'rag', 'unified'] as const;

// --- Zod schemas ---

const IngestSchema = z.object({
  content: z.string().min(1, 'content is required'),
  importance: z.number().min(0).max(1).optional(),
  kind: z.enum(KIND_VALUES).optional(),
  targetTier: z.enum(TIER_NAMES).optional()
});

const RecallSchema = z.object({
  query: z.string().optional(),
  scope: z.enum(SCOPE_VALUES).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  limit: z.number().int().positive().optional(),
  crossTier: z.boolean().optional(),
  kind: z.enum(KIND_VALUES).optional(),
  writeHeap: z.enum(['event', 'query', 'doc', 'ref']).optional()
});

const ListSchema = z.object({
  tier: z.enum(TIER_NAMES),
  limit: z.number().int().positive().optional()
});

const SearchSchema = z.object({
  query: z.string().min(1, 'query is required'),
  scope: z.enum(SCOPE_VALUES).optional(),
  limit: z.number().int().positive().optional()
});

const CaptureSchema = z.object({
  content: z.string().min(1, 'content is required'),
  importance: z.number().min(0).max(1).optional()
});

const WikiUpsertSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
  format: z.enum(['markdown', 'text', 'code', 'json']).optional()
});

const WikiSearchSchema = z.object({
  query: z.string().min(1, 'query is required'),
  limit: z.number().int().positive().optional()
});

const KbIngestSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.enum(['wiki', 'file', 'document', 'web']),
  title: z.string().min(1),
  content: z.string().min(1)
});

const KbSearchSchema = z.object({
  query: z.string().min(1, 'query is required'),
  limit: z.number().int().positive().optional()
});

// --- Helpers ---

function buildIngestOptions(args: z.infer<typeof IngestSchema>): MemoryEngineIngestOptions {
  const opts: MemoryEngineIngestOptions = {};
  if (args.importance !== undefined) opts.importance = args.importance;
  if (args.kind !== undefined) opts.kind = args.kind;
  if (args.targetTier !== undefined) opts.targetTier = args.targetTier;
  return opts;
}

function buildRecallOptions(args: z.infer<typeof RecallSchema>): MemoryEngineRecallOptions {
  const opts: MemoryEngineRecallOptions = {};
  if (args.minImportance !== undefined) opts.minImportance = args.minImportance;
  if (args.limit !== undefined) opts.limit = args.limit;
  if (args.crossTier !== undefined) opts.crossTier = args.crossTier;
  if (args.kind !== undefined) opts.kind = args.kind;
  if (args.writeHeap !== undefined) opts.writeHeap = args.writeHeap;
  return opts;
}

function validate<T extends z.ZodTypeAny>(
  schema: T,
  args: Record<string, unknown>
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const result = schema.safeParse(args);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { ok: false, error: issues };
}

export interface CreateMemoryMcpToolsOptions {
  engine: MemoryEngine;
  wiki?: WikiManager | undefined;
  kb?: KnowledgeBaseManager | undefined;
}

export function createMemoryMcpTools(options: CreateMemoryMcpToolsOptions): MemoryMcpToolSet {
  const { engine, wiki, kb } = options;
  const definitions: Record<string, McpToolDefinition> = {};
  const handlers: Record<string, McpToolHandler> = {};

  // --- memory_ingest ---
  definitions.memory_ingest = {
    name: 'memory_ingest',
    description: 'Ingest a memory event into the cognitive tier engine.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory content to ingest' },
        importance: { type: 'number', description: 'Optional importance score 0-1', minimum: 0, maximum: 1 },
        kind: { type: 'string', description: 'Memory kind', enum: [...KIND_VALUES] },
        targetTier: { type: 'string', description: 'Target tier', enum: [...TIER_NAMES] }
      },
      required: ['content']
    }
  };
  handlers.memory_ingest = async args => {
    const parsed = validate(IngestSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const opts = buildIngestOptions(parsed.data);
    const id = engine.ingest(parsed.data.content, opts);
    if (id === null) {
      return { content: [{ type: 'text', text: 'Error: ingestion failed' }], isError: true };
    }
    return { content: [{ type: 'text', text: `Ingested: ${id}` }] };
  };

  // --- memory_recall ---
  definitions.memory_recall = {
    name: 'memory_recall',
    description: 'Recall memories matching a query across cognitive tiers, wiki, and RAG.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Content filter or search term' },
        scope: {
          type: 'string',
          description: 'Search scope: tiers, wiki, rag, or unified (default)',
          enum: [...SCOPE_VALUES]
        },
        minImportance: { type: 'number', description: 'Minimum importance 0-1', minimum: 0, maximum: 1 },
        limit: { type: 'number', description: 'Max results' },
        crossTier: { type: 'boolean', description: 'Aggregate across tiers' }
      },
      required: []
    }
  };
  handlers.memory_recall = async args => {
    const parsed = validate(RecallSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }

    if (wiki && kb) {
      return unifiedSearch(parsed.data, engine, wiki, kb);
    }
    return tierRecall(parsed.data, engine);
  };

  // --- memory_awaken ---
  definitions.memory_awaken = {
    name: 'memory_awaken',
    description: 'Trigger consolidation and decay cycle.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  };
  handlers.memory_awaken = async _args => {
    const result = await engine.awaken();
    const lines = [
      `Awaken: ${result.durationMs}ms`,
      `Decay kept=${result.decayPass.kept} promoted=${result.decayPass.promoted} demoted=${result.decayPass.demoted} discarded=${result.decayPass.discarded}`,
      `Consolidation compressed=${result.consolidation.compressed} synthesized=${result.consolidation.synthesized} summarized=${result.consolidation.summarized}`
    ];
    if (result.learningCycle) {
      lines.push(
        `Learning: ${result.learningCycle.observationsExtracted} obs, ${result.learningCycle.consolidationsProduced} consolidations`
      );
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  };

  // --- memory_stats ---
  definitions.memory_stats = {
    name: 'memory_stats',
    description: 'Get tier utilization and budget statistics.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  };
  handlers.memory_stats = async _args => {
    const stats = engine.stats();
    const lines = [
      `Items: ${stats.totalItems}, Tokens: ${stats.totalTokens}, Budget: ${(stats.budgetUtilization * 100).toFixed(1)}%`
    ];
    for (const [tierName, tierStat] of Object.entries(stats.tierStats)) {
      lines.push(`  ${tierName}: ${tierStat.items} items, ${tierStat.usedTokens}/${tierStat.maxTokens} tok`);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  };

  // --- memory_lint ---
  definitions.memory_lint = {
    name: 'memory_lint',
    description: 'Check memory health.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  };
  handlers.memory_lint = async _args => {
    const stats = engine.stats();
    const issues: string[] = [];
    if (stats.totalItems === 0) issues.push('No memories');
    if (stats.budgetUtilization >= 1) issues.push('Budget exhausted');
    for (const [name, tierStat] of Object.entries(stats.tierStats)) {
      if (tierStat.utilization >= 0.95) issues.push(`${name} near capacity`);
    }
    if (issues.length === 0) {
      return { content: [{ type: 'text', text: 'Health: OK' }] };
    }
    return {
      content: [
        {
          type: 'text',
          text: `Issues (${issues.length}):\n- ${issues.join('\n- ')}`
        }
      ],
      isError: true
    };
  };

  // --- memory_list ---
  definitions.memory_list = {
    name: 'memory_list',
    description: 'List memories in a specific tier.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: { type: 'string', description: 'Tier name', enum: [...TIER_NAMES] },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['tier']
    }
  };
  handlers.memory_list = async args => {
    const parsed = validate(ListSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const listOpts: MemoryEngineRecallOptions = {
      tiers: [parsed.data.tier],
      crossTier: false
    };
    if (parsed.data.limit !== undefined) listOpts.limit = parsed.data.limit;
    const results = engine.recall(listOpts);
    const result = results[0];
    if (!result || result.items.length === 0) {
      return { content: [{ type: 'text', text: `No items in ${parsed.data.tier}.` }] };
    }
    const lines = result.items.map(
      item => `  ${item.id} (imp: ${item.importance.toFixed(2)}): ${item.content.slice(0, 120)}`
    );
    return {
      content: [
        {
          type: 'text',
          text: `${parsed.data.tier} (${result.items.length}):\n${lines.join('\n')}`
        }
      ]
    };
  };

  // --- memory_search ---
  definitions.memory_search = {
    name: 'memory_search',
    description: 'Search memories by content substring across tiers, wiki, and RAG.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        scope: {
          type: 'string',
          description: 'Search scope: tiers, wiki, rag, or unified (default)',
          enum: [...SCOPE_VALUES]
        },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  };
  handlers.memory_search = async args => {
    const parsed = validate(SearchSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    if (wiki && kb) {
      return unifiedSearch(
        { ...parsed.data, kind: undefined, writeHeap: undefined, minImportance: undefined, crossTier: undefined },
        engine,
        wiki,
        kb
      );
    }
    return tierRecall(
      { ...parsed.data, kind: undefined, writeHeap: undefined, minImportance: undefined, crossTier: undefined },
      engine
    );
  };

  // --- memory_capture ---
  definitions.memory_capture = {
    name: 'memory_capture',
    description: 'Capture raw content as a memory.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content' },
        importance: { type: 'number', description: 'Importance 0-1' }
      },
      required: ['content']
    }
  };
  handlers.memory_capture = async args => {
    const parsed = validate(CaptureSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const opts = buildIngestOptions({ ...parsed.data, kind: undefined, targetTier: undefined });
    const id = engine.ingest(parsed.data.content, opts);
    if (id === null) {
      return { content: [{ type: 'text', text: 'Error: ingestion failed' }], isError: true };
    }
    return { content: [{ type: 'text', text: `Ingested: ${id}` }] };
  };

  // --- wiki_upsert_page ---
  definitions.wiki_upsert_page = {
    name: 'wiki_upsert_page',
    description: 'Create or update a wiki page.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Unique page identifier' },
        title: { type: 'string', description: 'Page title' },
        body: { type: 'string', description: 'Page body content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        format: { type: 'string', enum: ['markdown', 'text', 'code', 'json'], description: 'Content format' }
      },
      required: ['pageId', 'title', 'body']
    }
  };
  handlers.wiki_upsert_page = async args => {
    if (!wiki) {
      return { content: [{ type: 'text', text: 'Error: wiki not available' }], isError: true };
    }
    const parsed = validate(WikiUpsertSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const page = await wiki.upsertPage({
      pageId: parsed.data.pageId,
      title: parsed.data.title,
      body: parsed.data.body,
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
      format: parsed.data.format ?? 'markdown',
      actorId: 'mcp'
    });
    return { content: [{ type: 'text', text: `Upserted wiki page: ${page.pageId} (v${page.version})` }] };
  };

  // --- wiki_search ---
  definitions.wiki_search = {
    name: 'wiki_search',
    description: 'Search wiki pages by full text.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  };
  handlers.wiki_search = async args => {
    if (!wiki) {
      return { content: [{ type: 'text', text: 'Error: wiki not available' }], isError: true };
    }
    const parsed = validate(WikiSearchSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const results = await wiki.searchFullText(parsed.data.query, parsed.data.limit ?? 10);
    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No wiki pages matched.' }] };
    }
    const lines = results.map(r => `${r.pageId} (score: ${r.score.toFixed(3)})`);
    return { content: [{ type: 'text', text: `Found ${results.length} wiki pages:\n${lines.join('\n')}` }] };
  };

  // --- kb_ingest ---
  definitions.kb_ingest = {
    name: 'kb_ingest',
    description: 'Ingest a document into the knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'Source identifier' },
        sourceType: { type: 'string', enum: ['wiki', 'file', 'document', 'web'], description: 'Source type' },
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document content' }
      },
      required: ['sourceId', 'sourceType', 'title', 'content']
    }
  };
  handlers.kb_ingest = async args => {
    if (!kb) {
      return { content: [{ type: 'text', text: 'Error: knowledge base not available' }], isError: true };
    }
    const parsed = validate(KbIngestSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const summary = await kb.ingest(parsed.data);
    return {
      content: [
        {
          type: 'text',
          text: `Ingested: ${summary.inserted} new, ${summary.updated} updated, ${summary.skipped} skipped`
        }
      ]
    };
  };

  // --- kb_search ---
  definitions.kb_search = {
    name: 'kb_search',
    description: 'Search the knowledge base for evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  };
  handlers.kb_search = async args => {
    if (!kb) {
      return { content: [{ type: 'text', text: 'Error: knowledge base not available' }], isError: true };
    }
    const parsed = validate(KbSearchSchema, args);
    if (!parsed.ok) {
      return { content: [{ type: 'text', text: `Error: ${parsed.error}` }], isError: true };
    }
    const results = await kb.search({
      query: parsed.data.query,
      limit: parsed.data.limit ?? 10,
      weights: { vector: 0.4, lexical: 0.3, entity: 0.2, temporal: 0.1 }
    });
    if (results.length === 0) {
      return { content: [{ type: 'text', text: 'No knowledge base evidence matched.' }] };
    }
    const lines = results.map(r => `${r.id} | ${r.title} (score: ${r.score.toFixed(3)}): ${r.content.slice(0, 120)}`);
    return { content: [{ type: 'text', text: `Found ${results.length} evidence:\n${lines.join('\n')}` }] };
  };

  return { definitions, handlers };
}

// --- Internal helpers ---

async function tierRecall(
  args: z.infer<typeof RecallSchema>,
  engine: MemoryEngine
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const opts = buildRecallOptions(args);
  const results = engine.recall(opts);

  let filtered = results;
  if (args.query) {
    const q = args.query.toLowerCase();
    filtered = results
      .map(r => ({
        ...r,
        items: r.items.filter(item => item.content.toLowerCase().includes(q))
      }))
      .filter(r => r.items.length > 0);
  }

  const lines: string[] = [];
  let totalItems = 0;
  for (const result of filtered) {
    for (const item of result.items) {
      lines.push(`[${result.tierName}] ${item.id} (imp: ${item.importance.toFixed(2)}): ${item.content.slice(0, 200)}`);
      totalItems++;
    }
  }

  if (lines.length === 0) {
    return { content: [{ type: 'text', text: 'No memories matched.' }] };
  }
  return {
    content: [{ type: 'text', text: `Found ${totalItems}:\n${lines.join('\n')}` }]
  };
}

async function unifiedSearch(
  args: z.infer<typeof RecallSchema>,
  engine: MemoryEngine,
  wiki: WikiManager,
  kb: KnowledgeBaseManager
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const query = args.query ?? '';
  const limit = args.limit ?? 10;
  const scope = args.scope ?? 'unified';

  const unifiedQuery: UnifiedMemoryQuery = {
    query,
    limit
  };

  if (scope === 'tiers') {
    unifiedQuery.includeWiki = false;
    unifiedQuery.includeRAG = false;
  } else if (scope === 'wiki') {
    unifiedQuery.includeTiers = false;
    unifiedQuery.includeRAG = false;
  } else if (scope === 'rag') {
    unifiedQuery.includeTiers = false;
    unifiedQuery.includeWiki = false;
  }

  const results = await queryUnified(engine, wiki, kb, unifiedQuery);

  if (results.length === 0) {
    return { content: [{ type: 'text', text: 'No results matched.' }] };
  }

  const lines: string[] = [];
  for (const result of results) {
    const prefix = `[${result.source}] ${result.id}`;
    const titlePart = result.title ? ` | ${result.title}` : '';
    const scorePart = ` (score: ${result.score.toFixed(3)})`;
    const contentPreview = result.content.slice(0, 200);
    lines.push(`${prefix}${titlePart}${scorePart}: ${contentPreview}`);
  }

  return {
    content: [{ type: 'text', text: `Found ${results.length} results:\n${lines.join('\n')}` }]
  };
}
