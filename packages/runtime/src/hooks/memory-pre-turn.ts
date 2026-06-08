import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * A single memory item returned by the memory provider.
 */
export interface MemoryItem {
  content: string;
  id: string;
  scope: string;
  score: number;
  title: string;
}

/**
 * Contract for the memory retrieval dependency consumed by the pre-turn hook.
 *
 * Mirrors the `ctx.memory.retrieve()` signature described in the orchestration
 * plan so that consumers can adapt any memory backend.
 */
export interface MemoryRetriever {
  retrieve(options: { limit?: number; minRelevance?: number; sessionId: string }): Promise<readonly MemoryItem[]>;
}

export interface CreateMemoryPreTurnHookOptions {
  /** Max memories to inject per turn (default: 10). */
  maxItems?: number;
  /** Memory provider used to retrieve relevant context. */
  memory: MemoryRetriever;
}

/**
 * Factory that creates a pre-turn hook handler which retrieves relevant
 * memory context and returns it as a `transform` payload.
 *
 * The handler fires on `UserPromptSubmit` — the point before a model call
 * where relevant session memory should be injected. Errors are isolated to
 * prevent a failing memory provider from crashing the hook chain.
 *
 * @example
 * ```ts
 * const hook = createMemoryPreTurnHook({ memory: myMemoryProvider });
 * registry.register('UserPromptSubmit', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createMemoryPreTurnHook(options: CreateMemoryPreTurnHookOptions): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  const maxItems = Math.max(1, options.maxItems ?? 10);

  return {
    id: 'memory:pre-turn',
    priority: 100,
    handler: async (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only inject memory on user-submitted turns
        if (event.type !== 'UserPromptSubmit') {
          return { continue: true };
        }

        const items = await options.memory.retrieve({
          sessionId: event.sessionId,
          limit: maxItems,
          minRelevance: 0.6
        });

        if (items.length === 0) {
          return { continue: true };
        }

        const memoryXml = items
          .map(
            item =>
              `<memory_item id="${escapeXml(item.id)}" scope="${escapeXml(item.scope)}" score="${item.score.toFixed(3)}"><title>${escapeXml(item.title)}</title><content>${escapeXml(item.content)}</content></memory_item>`
          )
          .join('');

        return { transform: `<memory_context>${memoryXml}</memory_context>` };
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return { continue: true };
      }
    }
  };
}

const XML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, ch => XML_ENTITIES[ch] ?? '');
}
