import type { CompressionStrategy, CompressionStrategyResult } from './compression-strategy.js';

function defaultEstimateTokens<TMessage>(message: TMessage): number {
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}

export function createNaiveDroppingStrategy<TMessage = unknown>(): CompressionStrategy<TMessage> {
  return {
    name: 'naive-dropping',
    compress(messages, options): CompressionStrategyResult<TMessage> {
      const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<TMessage>;
      const preserveLast = Math.max(0, options.preserveLast ?? 0);
      const retained = [...messages];

      let estimatedTokens = retained.reduce((total, message) => total + estimateTokens(message), 0);

      while (retained.length > preserveLast && estimatedTokens > options.maxTokens) {
        const removed = retained.shift();
        if (removed === undefined) {
          break;
        }

        estimatedTokens -= estimateTokens(removed);
      }

      return {
        metadata: {
          qualityScore: retained.length === messages.length ? 1 : 0.85,
          strategy: 'naive-dropping'
        },
        messages: retained
      };
    }
  };
}
