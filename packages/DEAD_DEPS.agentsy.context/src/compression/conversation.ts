import { createAnchoredIterativeStrategy } from '../strategies/anchored-iterative.js';
import { routeCompressionStrategy } from '../strategies/content-router.js';
import { createLayeredPruningStrategy } from '../strategies/layered-pruning.js';
import { createNaiveDroppingStrategy } from '../strategies/naive-dropping.js';

export interface CompressionOptions<TMessage> {
  estimateTokens?: (message: TMessage) => number;
  maxTokens: number;
  preserveLast?: number;
}

export interface CompressionResult<TMessage> {
  compressed: boolean;
  droppedCount: number;
  estimatedTokens: number;
  messages: TMessage[];
  metadata?: CompressionMetadata;
}

export interface CompressionMetadata {
  coherenceScore: number;
  driftDetected: boolean;
  preservedAnchors: Array<{ importance: number; index: number; reason: string; type: string }>;
  qualityScore: number;
  strategy: string;
}

export function compressConversation<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>
): CompressionResult<TMessage> {
  const estimateTokens = options.estimateTokens ?? defaultEstimateTokens<TMessage>;
  const route = routeCompressionStrategy(messages);
  let selectedStrategy: ReturnType<typeof createAnchoredIterativeStrategy<TMessage>>;

  if (route.strategy === 'anchored-iterative') {
    selectedStrategy = createAnchoredIterativeStrategy<TMessage>();
  } else if (route.strategy === 'layered-pruning') {
    selectedStrategy = createLayeredPruningStrategy<TMessage>();
  } else {
    selectedStrategy = createNaiveDroppingStrategy<TMessage>();
  }

  const result = selectedStrategy.compress(messages, {
    estimateTokens,
    maxTokens: options.maxTokens,
    preserveLast: Math.max(0, options.preserveLast ?? 0)
  });

  const estimatedTokens = result.messages.reduce((total, message) => total + estimateTokens(message), 0);
  const droppedCount = Math.max(0, messages.length - result.messages.length);

  return {
    compressed: droppedCount > 0,
    droppedCount,
    estimatedTokens: Math.max(0, estimatedTokens),
    messages: result.messages
  };
}

const defaultEstimateTokens = <TMessage>(message: TMessage): number => {
  if (typeof message === 'string') {
    return Math.max(1, Math.ceil(message.length / 4));
  }
  return Math.max(1, Math.ceil(JSON.stringify(message).length / 4));
};
