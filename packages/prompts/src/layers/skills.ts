/**
 * Skill layer types and composer for @agentsy/prompts.
 *
 * Defines the {@link SkillsLayer} segment type used in prompt pipeline
 * assembly and the {@link SkillsComposer} that maps active skill metadata
 * to a composable structure with aggregated token accounting.
 *
 * @module @agentsy/prompts/layers/skills
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An active skill that has been selected for the current turn.
 *
 * Carries the minimum metadata needed for composition: identity,
 * human-readable description, and pre-computed token cost.
 */
export interface ActiveSkill {
  /** Human-readable summary of what the skill does (≤1024 chars). */
  readonly description: string;
  /** Unique skill identifier (≤64 chars). */
  readonly name: string;
  /** Pre-computed token count for the skill's full content body. */
  readonly tokenCount: number;
}

/**
 * A composed skill segment ready for prompt assembly.
 */
export interface SkillsLayer {
  /** Active skill metadata entries in original order. */
  readonly skills: readonly SkillEntry[];
  /** Total token count — sum of all active skill token counts. */
  readonly tokenCount: number;
  /** Discriminant for layer-type routing. */
  readonly type: 'skills';
}

/**
 * A single skill entry within a composed {@link SkillsLayer}.
 */
export interface SkillEntry {
  /** Human-readable summary of the skill's purpose. */
  readonly description: string;
  /** Unique skill identifier. */
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/**
 * Deterministic skill composer.
 *
 * Accepts a list of {@link ActiveSkill} instances and produces a single
 * {@link SkillsLayer} by mapping each skill to its name and description
 * and summing their token counts.  The input order is preserved.
 */
export class SkillsComposer {
  /**
   * Compose active skills into a single layer.
   *
   * @param activeSkills - Skills selected for the current turn.  The array
   *   is not mutated.
   * @returns A fully populated {@link SkillsLayer}.
   */
  compose(activeSkills: readonly ActiveSkill[]): SkillsLayer {
    return {
      type: 'skills',
      skills: activeSkills.map(skill => ({
        name: skill.name,
        description: skill.description
      })),
      tokenCount: activeSkills.reduce((sum, skill) => sum + skill.tokenCount, 0)
    };
  }
}
