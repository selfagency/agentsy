import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * Contract for the wiki synthesis dependency consumed by this hook.
 */
export interface WikiSynthesizer {
  synthesize(sessionId: string): Promise<void>;
}

export interface CreateWikiSynthesisHookOptions {
  /** Trigger synthesis every N responses (default: 10). */
  everyNTurns?: number;
  /** Wiki provider used to trigger periodic synthesis. */
  wiki: WikiSynthesizer;
}

/**
 * Factory that creates a post-turn hook handler which triggers wiki synthesis
 * periodically during a session.
 *
 * Synthesis runs every `everyNTurns` PostResponse events to consolidate
 * episodic observations into wiki pages. Errors are isolated to prevent
 * a failing wiki provider from crashing the hook chain.
 */
export function createWikiSynthesisHook(options: CreateWikiSynthesisHookOptions): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  const everyNTurns = options.everyNTurns ?? 10;
  // Per-session turn counters — persisted only in memory, reset on restart
  const turnCounters = new Map<string, number>();

  return {
    id: 'memory:wiki-synthesis',
    priority: 50,
    handler: async (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        if (event.type !== 'PostResponse') {
          return { continue: true };
        }

        const count = (turnCounters.get(event.sessionId) ?? 0) + 1;
        turnCounters.set(event.sessionId, count);

        if (count % everyNTurns === 0) {
          await options.wiki.synthesize(event.sessionId);
        }

        return { continue: true };
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return { continue: true };
      }
    }
  };
}
