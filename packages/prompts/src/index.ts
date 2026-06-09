/**
 * Prompt optimization and agentic pattern management for the @agentsy platform.
 * Integrates with @agentsy/context for budget-aware prompt handling and @agentsy/memory for persistent storage.
 *
 * @module @agentsy/prompts
 */

// Public API exports
export const packageName = '@agentsy/prompts';

// Layer types, composers, and budget allocation
export type {
  ActiveSkill,
  BudgetAllocation,
  InstructionFile,
  InstructionsLayer,
  SkillEntry,
  SkillsLayer
} from './layers/index.js';
export {
  allocateBudget,
  estimateTokens,
  InstructionsComposer,
  SkillsComposer
} from './layers/index.js';
