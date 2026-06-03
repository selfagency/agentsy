import { createAnchoredIterativeStrategy } from '../strategies/anchored-iterative.js';
import { routeCompressionStrategy } from '../strategies/content-router.js';
import { createLayeredPruningStrategy } from '../strategies/layered-pruning.js';
import { createNaiveDroppingStrategy } from '../strategies/naive-dropping.js';
import { type CompactionSummarySchema, createCompactionSummarySchema } from './summary-schema.js';

export interface ManualCompactionInput<TMessage> {
  focus: string;
  maxTokens: number;
  messages: readonly TMessage[];
  preserveLast?: number;
  sessionId: string;
}

export interface ManualCompactionResult<TMessage> {
  messages: TMessage[];
  route: ReturnType<typeof routeCompressionStrategy>;
  summary: CompactionSummarySchema;
}

export function createManualCompaction<TMessage>(
  input: ManualCompactionInput<TMessage>
): ManualCompactionResult<TMessage> {
  const route = routeCompressionStrategy(input.messages);
  let strategy = createNaiveDroppingStrategy<TMessage>();

  if (route.strategy === 'anchored-iterative') {
    strategy = createAnchoredIterativeStrategy<TMessage>();
  } else if (route.strategy === 'layered-pruning') {
    strategy = createLayeredPruningStrategy<TMessage>();
  }

  const compressed = strategy.compress(input.messages, {
    maxTokens: input.maxTokens,
    preserveLast: input.preserveLast ?? 0
  });

  const summary = createCompactionSummarySchema({
    focus: input.focus,
    highlights: compressed.messages.slice(0, 3).map((message, index) => ({
      id: `${input.sessionId}:${index}`,
      kind: route.kind,
      title: typeof message === 'string' ? message.slice(0, 80) : 'compacted message'
    })),
    nextSteps: [`rehydrate:${input.focus}`],
    sessionId: input.sessionId
  });

  return {
    messages: compressed.messages,
    route,
    summary
  };
}
