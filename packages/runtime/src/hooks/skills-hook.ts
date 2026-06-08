import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * Minimal metadata for a discovered skill.
 */
export interface SkillMetadata {
  description: string;
  name: string;
  version?: string;
}

/**
 * A skill that has been activated (matched and loaded) for the current turn.
 */
export interface ActiveSkill {
  description: string;
  name: string;
  tokenCount: number;
}

/**
 * Contract for the skill discoverer dependency.
 *
 * Walks configured roots, parses frontmatter only, and returns minimal
 * metadata for all available skills.
 */
export interface SkillDiscoverer {
  discover(): SkillMetadata[];
}

/**
 * Contract for the skill activator dependency.
 *
 * Receives the user message and all discovered skill metadata, performs
 * semantic matching / relevance scoring, loads full bodies for matched
 * skills, and returns them ordered by relevance.
 */
export interface SkillActivator {
  activate(message: string, metadata: SkillMetadata[]): Promise<ActiveSkill[]>;
}

/**
 * Factory that creates a skills hook handler which discovers available
 * skills and activates the relevant ones based on the user message.
 *
 * The handler fires on `UserPromptSubmit` — the point where raw user
 * input has arrived and skills should be resolved before model dispatch.
 * Priority 50 runs after built-in safety / memory hooks (priority 100)
 * but before model-call hooks.
 *
 * @param discoverer - Skill discovery provider.
 * @param activator  - Skill activation (semantic matching + loading) provider.
 *
 * @example
 * ```ts
 * const hook = createSkillsHook(myDiscoverer, myActivator);
 * registry.register('UserPromptSubmit', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createSkillsHook(
  discoverer: SkillDiscoverer,
  activator: SkillActivator
): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  return {
    id: 'skills:activate',
    priority: 50,
    handler: async (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only activate skills on user-submitted turns
        if (event.type !== 'UserPromptSubmit') {
          return { continue: true };
        }

        const metadata = discoverer.discover();
        const active = await activator.activate(event.input, metadata);

        return {
          transform: {
            type: 'skills:activate',
            activeSkills: active,
            totalTokens: active.reduce((sum, s) => sum + s.tokenCount, 0)
          }
        };
      } catch {
        // Isolate hook errors — never propagate to the main execution loop
        return { continue: true };
      }
    }
  };
}
