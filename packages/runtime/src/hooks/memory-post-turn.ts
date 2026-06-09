import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * Contract for the memory capture dependency consumed by the post-turn hook.
 *
 * Mirrors the `ctx.memory.capture()` signature described in the orchestration
 * plan so that consumers can adapt any memory backend.
 */
export interface MemoryCapturer {
  capture(input: { observations: string[]; sessionId: string; sourceMessageId?: string }): Promise<void>;
}

export interface CreateMemoryPostTurnHookOptions {
  /** Memory provider used to capture observations from completed turns. */
  memory: MemoryCapturer;
}

/**
 * Extract meaningful observation strings from a response payload.
 *
 * Handles common response shapes:
 * - Plain strings → a single observation
 * - Objects with `content` or `text` fields → extracted content
 * - Everything else → serialized JSON snippet
 */
/**
 * Extract a string value from a known field on an object.
 */
function extractStringField(obj: Record<string, unknown>, field: string): string | undefined {
  if (!Object.hasOwn(obj, field)) {
    return;
  }
  const val = obj[field]; // nosemgrep: detect-object-injection — guarded by Object.hasOwn
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

export function extractObservations(response: unknown): string[] {
  if (typeof response === 'string') {
    return response.length > 0 ? [response] : [];
  }

  if (typeof response !== 'object' || response === null) {
    return [];
  }

  const obj = response as Record<string, unknown>;

  const content = extractStringField(obj, 'content');
  if (content !== undefined) {
    return [content];
  }

  const text = extractStringField(obj, 'text');
  if (text !== undefined) {
    return [text];
  }

  // Object with only empty known fields — nothing useful
  const keys = Object.keys(obj);
  if (keys.every(k => k === 'content' || k === 'text')) {
    return [];
  }

  // Unknown shape — serialize
  const serialized = JSON.stringify(obj);
  return serialized.length > 0 && serialized !== '{}' ? [serialized] : [];
}

/**
 * Factory that creates a post-turn hook handler which captures observations
 * from completed responses into the memory store.
 *
 * The handler fires on `PostResponseEvent` — the point after a response has
 * been delivered to the user where noteworthy information should be persisted.
 * Errors are isolated to prevent a failing memory provider from crashing the
 * hook chain.
 *
 * @example
 * ```ts
 * const hook = createMemoryPostTurnHook({ memory: myMemoryProvider });
 * registry.register('PostResponse', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createMemoryPostTurnHook(options: CreateMemoryPostTurnHookOptions): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  return {
    id: 'memory:post-turn',
    priority: 100,
    handler: async (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only capture memory on post-response events
        if (event.type !== 'PostResponse') {
          return { continue: true };
        }

        const observations = extractObservations(event.response);

        if (observations.length === 0) {
          return { continue: true };
        }

        await options.memory.capture({
          observations,
          sessionId: event.sessionId
        });

        return { continue: true };
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return { continue: true };
      }
    }
  };
}
