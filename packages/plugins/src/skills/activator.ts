/**
 * Skill activator — semantically matches user messages against discovered skills,
 * scores relevance, loads full skill bodies, and returns ordered results.
 *
 * @module @agentsy/plugins/skills
 */

import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import type { SkillMetadata } from './manifest.js';

/**
 * A matched skill that passed the relevance threshold, loaded with its full body.
 */
export interface ActiveSkill {
  /** Full skill body loaded from disk. */
  readonly body: string;
  /** Short description of the skill's purpose. */
  readonly description: string;
  /** Skill name (from manifest). */
  readonly name: string;
  /** Relevance score in [0, 1] where 1 = perfect match. */
  readonly score: number;
  /** Estimated token count of the full body (rough: length / 4). */
  readonly tokenCount: number;
}

/**
 * Configuration options for {@link SkillActivator}.
 */
export interface ActivatorOptions {
  /**
   * Weight given to the skill name vs description when scoring.
   * 1.0 = name only, 0.0 = description only.
   * @default 0.6
   */
  readonly nameWeight?: number;
  /**
   * Minimum relevance score [0, 1] required for a skill to be returned.
   * @default 0.1
   */
  readonly threshold?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_OPTIONS: Required<ActivatorOptions> = {
  threshold: 0.1,
  nameWeight: 0.6
} as const;

/**
 * Activates skills by semantically matching a user message against
 * discovered skill metadata, scoring relevance, and loading full bodies.
 *
 * Scoring uses keyword-term overlap with configurable name-vs-description
 * weighting. Results below the threshold are discarded; survivors are
 * returned in descending relevance order.
 */
export class SkillActivator {
  readonly options: Required<ActivatorOptions>;

  constructor(options: ActivatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Activate — match, score, and load skills relevant to `userMessage`.
   *
   * @param userMessage - The user's current message to match against.
   * @param metadata - Discovered skill metadata to evaluate.
   * @returns Active skills with full bodies, ordered by relevance (highest first).
   */
  async activate(userMessage: string, metadata: SkillMetadata[]): Promise<ActiveSkill[]> {
    if (metadata.length === 0) {
      return [];
    }

    const messageTokens = this.#tokenize(userMessage);
    if (messageTokens.size === 0) {
      return [];
    }

    const scored = metadata.map(skill => {
      const score = this.#score(messageTokens, skill);
      return { skill, score };
    });

    const passed = scored.filter(s => s.score >= this.options.threshold).sort((a, b) => b.score - a.score);

    const results: ActiveSkill[] = [];

    for (const { skill, score } of passed) {
      const body = await this.#loadBody(skill);
      const tokenCount = Math.max(1, Math.ceil(body.length / 4));

      results.push({
        name: skill.name,
        description: skill.description,
        body,
        score,
        tokenCount
      });
    }

    return results;
  }

  /**
   * Tokenize a string into a set of lowercase, non-trivial keyword stems.
   * Filters common English stop-words and punctuation.
   */
  #tokenize(text: string): Set<string> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !STOP_WORDS.has(t));

    return new Set(tokens);
  }

  /**
   * Compute a relevance score for a single skill against message tokens.
   * Score = nameWeight * nameScore + (1 - nameWeight) * descScore.
   * Each term score is the fraction of message tokens found in the respective field.
   */
  #score(messageTokens: Set<string>, skill: SkillMetadata): number {
    const nameTokens = this.#tokenize(skill.name);
    const descTokens = this.#tokenize(skill.description);

    const nameOverlap = this.#overlap(messageTokens, nameTokens);
    const descOverlap = this.#overlap(messageTokens, descTokens);

    const { nameWeight } = this.options;

    return nameWeight * nameOverlap + (1 - nameWeight) * descOverlap;
  }

  /**
   * Compute the fraction of `source` tokens that appear in `target`.
   * Returns 0 when source is empty.
   */
  #overlap(source: Set<string>, target: Set<string>): number {
    if (source.size === 0) {
      return 0;
    }
    let count = 0;
    for (const token of source) {
      if (target.has(token)) {
        count++;
      }
    }
    return count / source.size;
  }

  /**
   * Load the full body of a skill from disk.
   *
   * Resolution order (by the skill's `path` directory):
   * 1. `{path}/SKILL.md`
   * 2. `{path}/{name}.md` (when name differs from "SKILL")
   *
   * Returns an empty string if no file can be read.
   */
  async #loadBody(skill: SkillMetadata): Promise<string> {
    const skillDir = skill.path;

    // Try SKILL.md first
    const skillMdPath = resolve(skillDir, 'SKILL.md');
    try {
      return await readFile(skillMdPath, 'utf-8');
    } catch {
      // Fall through
    }

    // Try {name}.md if the name isn't "SKILL"
    if (skill.name !== 'SKILL') {
      const nameMd = extname(skill.name) === '.md' ? skill.name : `${skill.name}.md`;
      const namePath = resolve(skillDir, nameMd);
      try {
        return await readFile(namePath, 'utf-8');
      } catch {
        // Fall through
      }
    }

    return '';
  }
}

/**
 * Common English stop-words excluded from keyword tokenization.
 * Kept small — only words unlikely to carry semantic signal.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'had',
  'her',
  'was',
  'one',
  'our',
  'out',
  'has',
  'have',
  'been',
  'some',
  'them',
  'then',
  'than',
  'what',
  'when',
  'where',
  'which',
  'who',
  'how',
  'its',
  'also',
  'into',
  'just',
  'like',
  'more',
  'over',
  'such',
  'that',
  'this',
  'very',
  'will',
  'with',
  'would',
  'about',
  'could',
  'should',
  'their',
  'there',
  'these',
  'those',
  'make',
  'made',
  'from',
  'they',
  'your',
  'know',
  'want',
  'need',
  'tell',
  'give',
  'ask',
  'use',
  'say',
  'see',
  'get',
  'set'
]);
