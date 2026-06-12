import { findAnchors } from '../drift/anchor-finder.js';
import { scoreCoherence } from '../drift/drift-scorer.js';
import type { CompressionStrategy, CompressionStrategyResult } from './compression-strategy.js';

function defaultEstimateTokens<TMessage>(message: TMessage): number {
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
}

function isMessageLike(
  value: unknown
): value is { content: string; role: string; toolUse?: { args: unknown; name: string } } {
  return typeof value === 'object' && value !== null && 'content' in value && 'role' in value;
}

export function createAnchoredIterativeStrategy<TMessage = unknown>(): CompressionStrategy<TMessage> {
  return {
    name: 'anchored-iterative',
    compress(messages, options): CompressionStrategyResult<TMessage> {
      const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<TMessage>;
      const preserveLast = Math.max(0, options.preserveLast ?? 0);
      const retained = [...messages];
      const totalTokens = retained.reduce((total, message) => total + estimateTokens(message), 0);

      const messageLike = retained.filter(isMessageLike) as Array<{
        content: string;
        role: string;
        toolUse?: { args: unknown; name: string };
      }>;

      const normalizedMessages = messageLike.map(message => ({
        content: message.content,
        role: message.role,
        ...(message.toolUse === undefined ? {} : { toolUse: message.toolUse })
      }));
      const anchors = findAnchors(normalizedMessages);
      const coherence = scoreCoherence(normalizedMessages);
      const preservedIndices = new Set(anchors.map(anchor => anchor.index));

      let estimatedTokens = totalTokens;
      let cursor = 0;

      while (retained.length > preserveLast && estimatedTokens > options.maxTokens && cursor < retained.length) {
        if (preservedIndices.has(cursor) && cursor < retained.length - preserveLast) {
          cursor += 1;
          continue;
        }

        const removed = retained.splice(cursor, 1)[0];
        if (removed === undefined) {
          break;
        }

        estimatedTokens -= estimateTokens(removed);
      }

      return {
        metadata: {
          qualityScore: Math.max(0.5, Math.min(1, coherence)),
          strategy: 'anchored-iterative'
        },
        messages: retained
      };
    }
  };
}
