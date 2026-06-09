/**
 * Skill manifest types — declaration metadata for installable agent skills.
 *
 * @module @agentsy/plugins/skills
 */

/**
 * A skill's declaration metadata as authored in its frontmatter.
 * Describes the skill's identity — name, purpose, and authorship.
 */
export interface SkillManifest {
  /** Original author or maintainer of the skill. */
  readonly author?: string;
  /** Short description of the skill's purpose and behavior (max 1024 characters). */
  readonly description: string;
  /** SPDX license identifier or custom license string. */
  readonly license?: string;
  /** Human-readable skill name (max 64 characters). */
  readonly name: string;
  /** Semantic version of the skill. */
  readonly version?: string;
}

/**
 * A discovered skill on disk with its filesystem path and parsed manifest.
 * Augments {@link SkillManifest} with the location it was found at.
 */
export interface SkillMetadata {
  /** Original author or maintainer of the skill. */
  readonly author?: string;
  /** Short description of the skill's purpose and behavior (max 1024 characters). */
  readonly description: string;
  /** SPDX license identifier or custom license string. */
  readonly license?: string;
  /** Human-readable skill name (max 64 characters). */
  readonly name: string;
  /** Absolute path to the skill's directory or primary file on disk. */
  readonly path: string;
  /** Semantic version of the skill. */
  readonly version?: string;
}
