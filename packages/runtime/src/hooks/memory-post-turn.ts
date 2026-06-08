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
export function extractObservations(response: unknown): string[] {
  if (typeof response === 'string') {
    return response.length > 0 ? [response] : [];
  }

  if (typeof response === 'object' && response !== null) {
    const obj = response as Record<string, unknown>;

    if (typeof obj.content === 'string' && obj.content.length > 0) {
      return [obj.content];
    }

    if (typeof obj.text === 'string' && obj.text.length > 0) {
      return [obj.text];
    }

    // If the object only has empty known fields, return nothing
    const keys = Object.keys(obj);
    const knownKeys = keys.filter(k => k === 'content' || k === 'text');
    if (knownKeys.length === keys.length && keys.length > 0) {
      return [];
    }

    // Object shape without recognizable content fields — serialize
    const serialized = JSON.stringify(obj);
    if (serialized.length > 0 && serialized !== '{}') {
      return [serialized];
    }
  }

  return [];
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
