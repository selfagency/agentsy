/**
 * Tokenizer bridge — feeds accurate BPE token counts from @agentsy/tokenomics
 * to Magic Context's importance/decay heuristics.
 *
 * MC's built-in importance uses crude `text.length / 4` estimates. This adapter
 * provides accurate per-model token counts through the registered tokenizer registry,
 * enabling more precise budget enforcement and decay scheduling.
 */

import { TokenizerRegistry } from '../tokenizers/registry.js';

/**
 * Options for creating a budget provider.
 */
export interface BudgetProviderOptions {
  /** Default model to use when no model is specified (default: 'gpt-4o'). */
  defaultModel?: string;
}

/**
 * Accurate token budget provider using @agentsy/tokenomics tokenizers.
 *
 * Wraps the TokenizerRegistry to expose a simple token-counting API
 * suitable for consumption by Magic Context's pricing and budget logic.
 */
export function createCortexKitBudgetProvider(options: BudgetProviderOptions = {}) {
  const registry = new TokenizerRegistry();
  const defaultModel = options.defaultModel ?? 'generic-unknown';

  return {
    /**
     * Count tokens for a given text, optionally specifying the model.
     */
    countTokens(text: string, modelName?: string): number {
      const tokenizer = registry.resolve(modelName ?? defaultModel);
      return tokenizer.count(text);
    },

    /**
     * Compute the cost factor for a model (tokens per ~4 chars approximation ratio).
     * Returns 1.0 for the default heuristic, or the actual ratio for known models.
     */
    costFactor(modelName?: string): number {
      const tokenizer = registry.resolve(modelName ?? defaultModel);
      const sample = 'x'.repeat(400);
      return tokenizer.count(sample) / 100;
    },

    /**
     * Return the underlying registry for advanced use.
     */
    getRegistry(): TokenizerRegistry {
      return registry;
    }
  };
}
