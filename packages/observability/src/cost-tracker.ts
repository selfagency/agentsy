/**
 * Cost Tracker
 *
 * Tracks token usage and cost per LLM call, aggregated by provider and model.
 * Emits span attributes and structured log entries for cost telemetry.
 *
 * @module @agentsy/observability
 */

import type { Span } from './core/types.js';
import { SemanticAttributes } from './spans/semantic-conventions.js';

// ---------------------------------------------------------------------------
// Provider pricing (per 1K tokens, USD)
// ---------------------------------------------------------------------------

interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
}

const PROVIDER_PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    'gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015 },
    'gpt-4o-mini': { inputPer1K: 0.000_15, outputPer1K: 0.0006 },
    'gpt-4-turbo': { inputPer1K: 0.01, outputPer1K: 0.03 },
    'gpt-3.5-turbo': { inputPer1K: 0.0005, outputPer1K: 0.0015 }
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': { inputPer1K: 0.003, outputPer1K: 0.015 },
    'claude-3-opus-20240229': { inputPer1K: 0.015, outputPer1K: 0.075 },
    'claude-3-haiku-20240307': { inputPer1K: 0.000_25, outputPer1K: 0.001_25 }
  },
  mistral: {
    'mistral-large-latest': { inputPer1K: 0.002, outputPer1K: 0.006 },
    'mistral-small-latest': { inputPer1K: 0.001, outputPer1K: 0.003 }
  }
};

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

export interface CostTrackerOptions {
  /** Active span to attach cost attributes to. */
  span?: Span;
}

export interface CostSnapshot {
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  total: number;
}

export class CostTracker {
  private totalCost = 0;
  private readonly byProvider: Record<string, number> = {};
  private readonly byModel: Record<string, number> = {};
  private readonly span: Span | undefined;

  constructor(options: CostTrackerOptions = {}) {
    this.span = options.span;
  }

  /**
   * Compute cost for a given provider/model/token count.
   * Falls back to 0 for unknown models.
   */
  computeCost(provider: string, model: string, tokens: { input: number; output: number }): number {
    const providerPricing = PROVIDER_PRICING[provider];
    if (providerPricing === undefined) {
      return 0;
    }
    const pricing = providerPricing[model];
    if (pricing === undefined) {
      return 0;
    }
    return (tokens.input / 1000) * pricing.inputPer1K + (tokens.output / 1000) * pricing.outputPer1K;
  }

  /**
   * Track an LLM call: compute cost, update aggregates, emit span attributes.
   */
  trackLlmCall(provider: string, model: string, tokens: { input: number; output: number }): number {
    const cost = this.computeCost(provider, model, tokens);
    this.totalCost += cost;

    this.byProvider[provider] = (this.byProvider[provider] ?? 0) + cost;
    this.byModel[model] = (this.byModel[model] ?? 0) + cost;

    if (this.span !== undefined) {
      this.span.setAttributes({
        [SemanticAttributes.llm.costUsd]: cost,
        [SemanticAttributes.llm.inputTokens]: tokens.input,
        [SemanticAttributes.llm.outputTokens]: tokens.output,
        [SemanticAttributes.llm.model]: model,
        [SemanticAttributes.llm.provider]: provider
      });
    }

    return cost;
  }

  /**
   * Get a snapshot of accumulated costs.
   */
  getSessionCost(): CostSnapshot {
    return {
      total: this.totalCost,
      byProvider: { ...this.byProvider },
      byModel: { ...this.byModel }
    };
  }
}
