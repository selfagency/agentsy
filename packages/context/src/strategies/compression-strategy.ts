export interface CompressionStrategyResult<TMessage> {
  messages: TMessage[];
  metadata: {
    qualityScore: number;
    hiddenCount?: number;
    prunedCount?: number;
    prunedTokens?: number;
    preservedTailCount?: number;
    strategy: string;
  };
}

export interface CompressionStrategyOptions<TMessage> {
  estimateTokens?: (message: TMessage) => number;
  maxTokens: number;
  preserveLast?: number;
  preservePinned?: boolean;
}

export interface CompressionStrategy<TMessage = unknown> {
  compress(
    messages: readonly TMessage[],
    options: CompressionStrategyOptions<TMessage>
  ): CompressionStrategyResult<TMessage>;
  name: string;
}

export interface CompressionStrategyRegistry<TMessage = unknown> {
  register(strategy: CompressionStrategy<TMessage>): void;
  resolve(name: string): CompressionStrategy<TMessage> | null;
}

export function createCompressionStrategyRegistry<TMessage = unknown>(): CompressionStrategyRegistry<TMessage> {
  const strategies = new Map<string, CompressionStrategy<TMessage>>();

  return {
    register(strategy) {
      strategies.set(strategy.name, strategy);
    },
    resolve(name) {
      return strategies.get(name) ?? null;
    }
  };
}
