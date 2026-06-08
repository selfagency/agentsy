/**
 * Barrel module for prompt layer types and composers.
 *
 * Re-exports the public API of every layer sub-module so consumers can
 * import everything from a single path:
 *
 * ```ts
 * import { InstructionsComposer, SkillsComposer, allocateBudget } from '@agentsy/prompts/layers';
 * ```
 *
 * @module @agentsy/prompts/layers
 */

// Budget allocation
export type { BudgetAllocation } from './budget.js';
export { allocateBudget } from './budget.js';
// Instruction layer
export type { InstructionFile, InstructionsLayer } from './instructions.js';
export { estimateTokens, InstructionsComposer } from './instructions.js';
// Skill layer
export type { ActiveSkill, SkillEntry, SkillsLayer } from './skills.js';
export { SkillsComposer } from './skills.js';
