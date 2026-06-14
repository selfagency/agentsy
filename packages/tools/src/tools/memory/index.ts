import type { ToolDefinition } from '../../definitions.js';

/**
 * Minimal memory provider contract for tool handlers.
 */
export interface MemoryToolProvider {
  capture(options: { content: string; expiresAt?: Date; sessionId: string; type: string }): Promise<{ id: string }>;

  query(options: {
    limit: number;
    minRelevance: number;
    query: string;
    sessionId: string;
  }): Promise<Array<{ content: string; id: string; score: number; title: string }>>;
}

export interface CreateMemoryToolsOptions {
  /** Memory provider instance. */
  memory: MemoryToolProvider;
  /** Session identifier. */
  sessionId: string;
}

/**
 * Create memory management tools for the agent runtime.
 */
export function createMemoryTools(options: CreateMemoryToolsOptions): ToolDefinition[] {
  const { memory, sessionId } = options;

  return [
    {
      name: 'memory_append',
      description: 'Store a fact, preference, or observation in long-term memory.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      parameters: [
        {
          name: 'type',
          type: 'string',
          required: true,
          description: 'Fact type (user_preference, entity, procedure, constraint)'
        },
        { name: 'content', type: 'string', required: true, description: 'Fact content to store' },
        { name: 'expiresAtDays', type: 'number', required: false, description: 'TTL in days' }
      ],
      handler: async input => {
        const type = typeof input.type === 'string' ? input.type : '';
        const content = typeof input.content === 'string' ? input.content : '';
        if (!(type && content)) {
          return { ok: false, data: null, error: 'Missing required parameters: type and content' };
        }
        try {
          const expiresAt =
            typeof input.expiresAtDays === 'number'
              ? new Date(Date.now() + input.expiresAtDays * 86_400_000)
              : undefined;

          const base = { content, sessionId, type };
          const captureInput = expiresAt === undefined ? base : { ...base, expiresAt };
          const result = await memory.capture(captureInput);
          return { ok: true, data: { id: result.id, stored: true } };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, data: null, error: `memory_append error: ${message}` };
        }
      }
    },
    {
      name: 'memory_search',
      description: 'Search long-term memory for relevant context.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      parameters: [
        { name: 'query', type: 'string', required: true, description: 'Search query' },
        { name: 'limit', type: 'number', required: false, description: 'Max results (default: 5)' }
      ],
      handler: async input => {
        const query = typeof input.query === 'string' ? input.query : '';
        if (!query) {
          return { ok: false, data: null, error: 'Missing required parameter: query' };
        }
        try {
          const limit = typeof input.limit === 'number' ? input.limit : 5;
          const results = await memory.query({
            limit,
            minRelevance: 0.5,
            query,
            sessionId
          });
          return { ok: true, data: { results } };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { ok: false, data: null, error: `memory_search error: ${message}` };
        }
      }
    }
  ];
}
