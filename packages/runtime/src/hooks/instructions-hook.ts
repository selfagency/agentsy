import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * A single discovered instruction file.
 */
export interface InstructionFile {
  alwaysInject: boolean;
  applyTo?: string;
  content: string;
  path: string;
  priority: number;
  scope?: string;
}

/**
 * Contract for the instruction discoverer dependency.
 *
 * Walks configured paths (project AGENTS.md, CLAUDE.md,
 * copilot-instructions.md, cursor rules, user-global files) and returns
 * all instruction files ordered by priority (highest first).
 */
export interface InstructionsDiscoverer {
  discover(): InstructionFile[];
}

/**
 * Factory that creates an instructions hook handler which discovers
 * instruction files and composes them into the system prompt.
 *
 * The handler fires on `PreModelCall` — the last opportunity to inject
 * system-level instructions into the prompt before it is sent to the
 * model. Priority 100 ensures it runs at the highest precedence,
 * alongside other critical system hooks.
 *
 * @param discoverer - Instruction discovery provider.
 *
 * @example
 * ```ts
 * const hook = createInstructionsHook(myDiscoverer);
 * registry.register('PreModelCall', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createInstructionsHook(discoverer: InstructionsDiscoverer): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  return {
    id: 'instructions:inject',
    priority: 100,
    handler: (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only compose instructions before model calls
        if (event.type !== 'PreModelCall') {
          return Promise.resolve({ continue: true });
        }

        const instructions = discoverer.discover();
        if (instructions.length === 0) {
          return Promise.resolve({ continue: true });
        }

        const composed = instructions
          .toSorted((a, b) => b.priority - a.priority)
          .map(i => i.content)
          .join('\n\n');

        return Promise.resolve({
          transform: {
            type: 'instructions:inject',
            content: composed,
            tokenCount: estimateTokens(composed),
            instructionCount: instructions.length
          }
        });
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return Promise.resolve({ continue: true });
      }
    }
  };
}

/**
 * Rough token estimate: ~4 chars per token for English text.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
