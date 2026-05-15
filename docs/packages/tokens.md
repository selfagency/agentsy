# `@agentsy/tokens`

- **Status:** Published
- **Role:** Token budgets, pacing, cost tracking, and conversation compression helpers

## Where it fits

Use `@agentsy/tokens` when you need lightweight budget enforcement around model usage, conversation trimming before context overflow, or rate-aware pacing across providers.

## Available APIs

- `createTokenLedger`
- `createInMemoryTokenManager`
- `compressConversation`
- `compressOutput`
- `PacingController`
- `TokenBudget`, `TokenRequest`, `TokenUsage`, `TokenAllocation`
- `CostAnalysis`, `OptimizationSuggestion`, `RateLimit`, `RateLimitStatus`

## Common neighbors

- `@agentsy/runtime`
- `@agentsy/providers`
- `@agentsy/session`

## Implementation example with neighbors

```ts
import { PacingController, compressConversation, createInMemoryTokenManager } from '@agentsy/tokens';

const manager = createInMemoryTokenManager();
await manager.createBudget({
  name: 'default',
  provider: 'openai',
  model: 'gpt-4.1-mini',
  maxTokens: 12_000,
  maxCost: 5,
  periodMs: 60_000,
  resetStrategy: 'rolling',
  priority: 'high',
});

const pacing = new PacingController(manager);
const compressed = compressConversation(['a', 'b', 'c'], { maxTokens: 2, estimateTokens: () => 1 });

console.log(compressed.messages);
console.log(
  await pacing.throttleRequest({
    provider: 'openai',
    model: 'gpt-4.1-mini',
    estimatedTokens: 250,
    requestType: 'completion',
  }),
);
```
