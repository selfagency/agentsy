import type { MemoryEngine, MemoryEngineIngestOptions, MemoryEngineRecallOptions } from '../cognitive/memory-engine.js';
import type { TierName } from '../cognitive/tier-types.js';
import type { McpToolDefinition, McpToolHandler } from './protocol.js';

export interface MemoryMcpToolSet {
  definitions: Record<string, McpToolDefinition>;
  handlers: Record<string, McpToolHandler>;
}

const KIND_VALUES = ['semantic', 'episodic', 'procedural', 'sensory'] as const;
type KindValue = (typeof KIND_VALUES)[number];

function buildIngestOptions(args: Record<string, unknown>): MemoryEngineIngestOptions {
  const opts: MemoryEngineIngestOptions = {};
  if (typeof args.importance === 'number') opts.importance = args.importance;
  if (typeof args.kind === 'string' && (KIND_VALUES as readonly string[]).includes(args.kind)) {
    opts.kind = args.kind as KindValue;
  }
  if (typeof args.targetTier === 'string') opts.targetTier = args.targetTier as TierName;
  return opts;
}

function buildRecallOptions(args: Record<string, unknown>): MemoryEngineRecallOptions {
  const opts: MemoryEngineRecallOptions = {};
  if (typeof args.minImportance === 'number') opts.minImportance = args.minImportance;
  if (typeof args.limit === 'number') opts.limit = args.limit;
  if (typeof args.crossTier === 'boolean') opts.crossTier = args.crossTier;
  const kindValues = ['semantic', 'episodic', 'procedural', 'sensory'] as const;
  if (typeof args.kind === 'string' && kindValues.includes(args.kind as (typeof kindValues)[number])) {
    opts.kind = args.kind as 'semantic' | 'episodic' | 'procedural' | 'sensory';
  }
  const heapValues = ['event', 'query', 'doc', 'ref'] as const;
  if (typeof args.writeHeap === 'string' && heapValues.includes(args.writeHeap as (typeof heapValues)[number])) {
    opts.writeHeap = args.writeHeap as 'event' | 'query' | 'doc' | 'ref';
  }
  return opts;
}

function coerceString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function coerceOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function createMemoryMcpTools(engine: MemoryEngine): MemoryMcpToolSet {
  const definitions: Record<string, McpToolDefinition> = {};
  const handlers: Record<string, McpToolHandler> = {};

  // --- Handler functions (defined first to avoid forward-reference issues) ---

  const ingestHandler: McpToolHandler = async args => {
    const content = coerceString(args.content);
    if (!content) {
      return {
        content: [{ type: 'text', text: 'Error: content is required' }],
        isError: true
      };
    }
    const opts = buildIngestOptions(args);
    const id = engine.ingest(content, opts);
    if (id === null) {
      return {
        content: [{ type: 'text', text: 'Error: ingestion failed' }],
        isError: true
      };
    }
    return { content: [{ type: 'text', text: `Ingested: ${id}` }] };
  };

  const recallHandler: McpToolHandler = async args => {
    const opts = buildRecallOptions(args);
    const results = engine.recall(opts);

    let filtered = results;
    const query = coerceOptionalString(args.query);
    if (query) {
      const q = query.toLowerCase();
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
        lines.push(
          `[${result.tierName}] ${item.id} (imp: ${item.importance.toFixed(2)}): ${item.content.slice(0, 200)}`
        );
        totalItems++;
      }
    }

    if (lines.length === 0) {
      return { content: [{ type: 'text', text: 'No memories matched.' }] };
    }
    return {
      content: [{ type: 'text', text: `Found ${totalItems}:\n${lines.join('\n')}` }]
    };
  };

  // --- Definitions & handler assignments ---

  definitions.memory_ingest = {
    name: 'memory_ingest',
    description: 'Ingest a memory event into the cognitive tier engine.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to ingest'
        },
        importance: {
          type: 'number',
          description: 'Optional importance score 0-1',
          minimum: 0,
          maximum: 1
        },
        kind: {
          type: 'string',
          description: 'Memory kind',
          enum: ['semantic', 'episodic', 'procedural', 'sensory']
        },
        targetTier: {
          type: 'string',
          description: 'Target tier',
          enum: ['sensory_buffer', 'sensory_register', 'working_memory', 'short_term_memory', 'long_term_memory']
        }
      },
      required: ['content']
    }
  };
  handlers.memory_ingest = ingestHandler;

  definitions.memory_recall = {
    name: 'memory_recall',
    description: 'Recall memories matching a query across cognitive tiers.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Content filter substring' },
        minImportance: {
          type: 'number',
          description: 'Minimum importance 0-1',
          minimum: 0,
          maximum: 1
        },
        limit: { type: 'number', description: 'Max results' },
        crossTier: { type: 'boolean', description: 'Aggregate across tiers' }
      },
      required: []
    }
  };
  handlers.memory_recall = recallHandler;

  definitions.memory_awaken = {
    name: 'memory_awaken',
    description: 'Trigger consolidation and decay cycle.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
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

  definitions.memory_stats = {
    name: 'memory_stats',
    description: 'Get tier utilization and budget statistics.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  };
  handlers.memory_stats = async _args => {
    const stats = engine.stats();
    const snap = engine.snapshot();
    const lines = [
      `Items: ${stats.totalItems}, Tokens: ${stats.totalTokens}, Budget: ${(stats.budgetUtilization * 100).toFixed(1)}%`
    ];
    for (const [tierName, tierStat] of Object.entries(stats.tierStats)) {
      lines.push(`  ${tierName}: ${tierStat.items} items, ${tierStat.usedTokens}/${tierStat.maxTokens} tok`);
    }
    lines.push(`Scheduler: ${snap.schedulerRunning}`);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  };

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

  definitions.memory_list = {
    name: 'memory_list',
    description: 'List memories in a specific tier.',
    inputSchema: {
      type: 'object',
      properties: {
        tier: {
          type: 'string',
          description: 'Tier name',
          enum: ['sensory_buffer', 'sensory_register', 'working_memory', 'short_term_memory', 'long_term_memory']
        },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['tier']
    }
  };
  handlers.memory_list = async args => {
    const tier = String(args.tier) as TierName;
    const listOpts: MemoryEngineRecallOptions = {
      tiers: [tier],
      crossTier: false
    };
    if (typeof args.limit === 'number') listOpts.limit = args.limit;
    const results = engine.recall(listOpts);
    const result = results[0];
    if (!result || result.items.length === 0) {
      return { content: [{ type: 'text', text: `No items in ${tier}.` }] };
    }
    const lines = result.items.map(
      item => `  ${item.id} (imp: ${item.importance.toFixed(2)}): ${item.content.slice(0, 120)}`
    );
    return {
      content: [
        {
          type: 'text',
          text: `${tier} (${result.items.length}):\n${lines.join('\n')}`
        }
      ]
    };
  };

  definitions.memory_search = {
    name: 'memory_search',
    description: 'Search memories by content substring.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Max results' }
      },
      required: ['query']
    }
  };
  handlers.memory_search = recallHandler;

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
  handlers.memory_capture = ingestHandler;

  return { definitions, handlers };
}
