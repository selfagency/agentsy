import type { CompressionStrategy, CompressionStrategyResult } from './compression-strategy.js';

export interface LayeredPruningMessageLike {
  compactedAt?: number;
  content?: string;
  hidden?: boolean;
  role?: string;
}

export interface LayeredPruningOptions<TMessage> {
  estimateTokens?: (message: TMessage) => number;
  maxTokens: number;
  preserveLast?: number;
  preservePinned?: boolean;
}

function defaultEstimateTokens<TMessage>(message: TMessage): number {
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}

function isHiddenMessage(value: unknown): value is LayeredPruningMessageLike {
  return typeof value === 'object' && value !== null && ('hidden' in value || 'compactedAt' in value);
}

export function createLayeredPruningStrategy<TMessage = unknown>(): CompressionStrategy<TMessage> {
  return {
    name: 'layered-pruning',
    compress(messages, options): CompressionStrategyResult<TMessage> {
      const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<TMessage>;
      const preserveLast = Math.max(0, options.preserveLast ?? 0);
      const retained = [...messages];
      const visible = retained.filter(message => {
        if (!isHiddenMessage(message)) {
          return true;
        }

        if (options.preservePinned === true && message.compactedAt !== undefined) {
          return true;
        }

        return message.hidden !== true;
      });
      const hiddenCount = retained.length - visible.length;

      let prunedTokens = 0;
      let prunedCount = 0;
      let estimatedTokens = visible.reduce((total, message) => total + estimateTokens(message), 0);

      while (visible.length > preserveLast && estimatedTokens > options.maxTokens) {
        const removed = visible.shift();
        if (removed === undefined) {
          break;
        }

        estimatedTokens -= estimateTokens(removed);
        prunedTokens += estimateTokens(removed);
        prunedCount += 1;
      }

      return {
        metadata: {
          hiddenCount,
          preservedTailCount: preserveLast,
          prunedCount,
          prunedTokens,
          qualityScore: retained.length === visible.length ? 1 : 0.9,
          strategy: 'layered-pruning'
        },
        messages: visible
      };
    }
  };
}
