import type { CompressionStrategy, CompressionStrategyResult } from './compression-strategy.js';

export interface HierarchicalSummarizationLayer<TMessage> {
  messages: readonly TMessage[];
  name: 'core' | 'supporting' | 'overflow';
}

export interface HierarchicalSummarizationOptions<TMessage> {
  estimateTokens?: (message: TMessage) => number;
  maxTokens: number;
  preserveLast?: number;
}

function defaultEstimateTokens<TMessage>(message: TMessage): number {
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}

function splitIntoLayers<TMessage>(messages: readonly TMessage[]): HierarchicalSummarizationLayer<TMessage>[] {
  const coreEnd = Math.max(1, Math.ceil(messages.length / 3));
  const supportEnd = Math.max(coreEnd, Math.ceil((messages.length * 2) / 3));

  return [
    { messages: messages.slice(0, coreEnd), name: 'core' },
    { messages: messages.slice(coreEnd, supportEnd), name: 'supporting' },
    { messages: messages.slice(supportEnd), name: 'overflow' }
  ];
}

export function createHierarchicalSummarizationStrategy<TMessage = unknown>(): CompressionStrategy<TMessage> {
  return {
    name: 'hierarchical-summarization',
    compress(messages, options): CompressionStrategyResult<TMessage> {
      const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<TMessage>;
      const preserveLast = Math.max(0, options.preserveLast ?? 0);
      const layers = splitIntoLayers(messages);
      const retained = [...messages];

      let totalTokens = retained.reduce((total, message) => total + estimateTokens(message), 0);
      const summaryBudget = Math.max(1, Math.floor(options.maxTokens / 3));

      if (totalTokens > options.maxTokens) {
        const overflow = layers.find(layer => layer.name === 'overflow')?.messages ?? [];
        while (retained.length > preserveLast && totalTokens > options.maxTokens && overflow.length > 0) {
          const removed = retained.shift();
          if (removed === undefined) {
            break;
          }

          totalTokens -= estimateTokens(removed);
        }
      }

      return {
        metadata: {
          qualityScore: retained.length === messages.length ? 1 : 0.88,
          strategy: 'hierarchical-summarization'
        },
        messages: retained.slice(-Math.max(preserveLast, summaryBudget) || retained.length)
      };
    }
  };
}
