# @agentsy/context

Compression, drift detection, reversible output shaping, and cache-friendly prompt planning for LLM applications.

## Status

**Version**: 0.2.0-alpha.0  
**License**: GPL-3.0-or-later  
**Published**: [@agentsy/core](https://www.npmjs.com/package/@agentsy/core) v0.2.0, [@agentsy/types](https://www.npmjs.com/package/@agentsy/types) v0.1.1

## Installation

```bash
npm install @agentsy/context @agentsy/core @agentsy/types
```

## Quick Start

### Compress Conversation History

```typescript
import { compressConversation } from '@agentsy/context';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const messages: Message[] = [
  { role: 'system', content: 'You are an AI programming assistant...' },
  { role: 'user', content: 'Help me refactor this function...' },
  { role: 'assistant', content: 'Here is the refactored code...' },
  // ... more messages
];

const result = compressConversation(messages, {
  maxTokens: 200000,
  preserveLast: 2, // Keep last 2 messages for continuity
  estimateTokens: (msg) => Math.ceil(msg.content.length / 4)
});

console.log(`Dropped ${result.droppedCount} messages`);
console.log(`Retained ${result.retained.length} messages`);
console.log(`Estimated tokens: ${result.estimatedTokens}`);
```

### Compress Output

```typescript
import { compressOutput } from '@agentsy/context';

const longResponse = `
  This is a very long response that contains a lot of filler text.
  Basically, you should consider removing unnecessary words.
  Here's some code:

  \`\`\`typescript
  const example = "preserve this exactly";
  \`\`\`

  And a link: https://example.com/docs
`;

const compressed = compressOutput(longResponse, {
  level: 'full',
  preserve: {
    codeFences: true,
    inlineCode: true,
    urls: true
  }
});

console.log(compressed);
// Output: Code blocks, inline code, and URLs preserved exactly
// Filler words removed: "basically", "should consider", "a lot of"
```

### Cache Prompt Plans

```typescript
import { createCachePromptPlan } from '@agentsy/context';
import { applyOpenAIPromptCaching } from '@agentsy/providers/caching';

const plan = createCachePromptPlan({
  prefix: 'ctx-v1',
  provider: 'openai'
});

const cached = applyOpenAIPromptCaching('prompt body', plan);

console.log(cached.prompt_cache_key); // openai:ctx-v1
```

### Manual Compaction

```typescript
import { createManualCompaction } from '@agentsy/context';

const result = createManualCompaction({
  focus: 'architecture',
  maxTokens: 200,
  messages: ['diff --git a/a b/a', 'plain prose'],
  sessionId: 'sess-1'
});

console.log(result.summary.focus); // architecture
console.log(result.summary.nextSteps); // ['rehydrate:architecture']
```

### Token Management

```typescript
import { createInMemoryTokenManager } from '@agentsy/context';

const manager = createInMemoryTokenManager();

// Create a budget
const budget = await manager.createBudget({
  maxTokens: 100000,
  maxCost: 5.0,
  model: 'gpt-4',
  name: 'default',
  periodMs: 3600000, // 1 hour
  priority: 'high',
  provider: 'openai',
  resetStrategy: 'rolling'
});

// Request token allocation
const allocation = await manager.requestTokens({
  estimatedTokens: 5000,
  estimatedCost: 0.25,
  model: 'gpt-4',
  provider: 'openai',
  requestType: 'completion',
  budgetId: budget.id,
  priority: 'high'
});

if (allocation.conditions) {
  console.log('Allocation conditions:', allocation.conditions);
} else {
  console.log(`Allocated ${allocation.allocatedTokens} tokens`);
}

// Record actual usage after request
await manager.recordUsage({
  budgetId: budget.id,
  tokensUsed: 4800,
  cost: 0.24,
  model: 'gpt-4',
  provider: 'openai',
  requestType: 'completion'
});

// Check budget status
const status = await manager.getBudgetStatus(budget.id);
console.log(`Remaining tokens: ${status.remainingTokens}`);
console.log(`Remaining cost: $${status.remainingCost.toFixed(2)}`);
```

### Rate Limiting with Pacing

```typescript
import { PacingController } from '@agentsy/context';

const pacing = new PacingController({
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000
});

// Check if request should be throttled
const waitTime = pacing.getWaitTime();
if (waitTime > 0) {
  console.log(`Rate limited, waiting ${waitTime}ms`);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

// Update rate limits after response
pacing.updateRateLimits({
  requestsRemaining: 59,
  requestsReset: new Date(Date.now() + 60000),
  limit: 60
});

// Check if request would be rate limited
const check = pacing.checkRateLimit();
if (check.limited) {
  console.log('Request would be rate limited');
}
```

## API Reference

### compressConversation

Compresses a conversation history to fit within a token budget.

```typescript
function compressConversation<TMessage>(
  messages: readonly TMessage[],
  options: CompressionOptions<TMessage>
): CompressionResult<TMessage>
```

**Parameters:**

- `messages`: Array of messages to compress
- `options.maxTokens`: Maximum tokens to retain
- `options.preserveLast`: Number of recent messages to always preserve (default: 0)
- `options.estimateTokens`: Function to estimate tokens per message

**Returns:**

- `retained`: Array of messages that fit in budget
- `droppedCount`: Number of messages dropped
- `estimatedTokens`: Estimated token count of retained messages

### compressOutput

Compresses output text while preserving code blocks, URLs, and other critical elements.

```typescript
function compressOutput(
  input: string,
  options?: OutputCompressionOptions
): string
```

**Parameters:**

- `input`: Text to compress
- `options.level`: Compression level - `'lite'` (40-50%), `'full'` (65-75%), `'ultra'` (75-87%)
- `options.preserve`: What to preserve (codeFences, inlineCode, urls)

**Returns:** Compressed text string

### compressOutputDetailed / compressOutputV2

Use the detailed helpers when you need content kind, routing, metrics, or reversible markers.

### createInMemoryTokenManager

Creates an in-memory token budget manager.

```typescript
function createInMemoryTokenManager(): TokenManager
```

**Returns:** Token manager instance with methods:

- `createBudget(config)`: Create a new budget
- `requestTokens(request)`: Request token allocation
- `recordUsage(usage)`: Record actual token usage
- `getBudgetStatus(budgetId)`: Get budget status
- `getUsage(filter)`: Get usage records
- `resetBudget(budgetId)`: Reset budget usage

### PacingController

Rate limiting controller with adaptive pacing.

```typescript
class PacingController {
  constructor(config: PacingConfig)
  throttleRequest(): Promise<void>
  getWaitTime(): number
  updateRateLimits(limits: RateLimitInfo)
  checkRateLimit(): RateLimitStatus
}
```

## Use Cases

### 1. Context Window Management

```typescript
import { compressConversation } from '@agentsy/context';

function prepareLLMRequest(
  messages: Message[],
  maxTokens: number
): Message[] {
  const result = compressConversation(messages, {
    maxTokens: maxTokens - 10000, // Safety margin
    preserveLast: 2,
    estimateTokens: (msg) => Math.ceil(msg.content.length / 4)
  });

  if (result.droppedCount > 0) {
    console.warn(`Dropped ${result.droppedCount} messages to fit budget`);
  }

  return result.retained;
}
```

### 2. Cost-Aware Request Routing

```typescript
import { createInMemoryTokenManager } from '@agentsy/context';

const manager = createInMemoryTokenManager();

async function routeRequest(
  model: string,
  estimatedTokens: number
): Promise<string> {
  const budget = await manager.createBudget({
    maxCost: 10.0,
    maxTokens: 100000,
    model,
    name: 'routing-budget',
    periodMs: 3600000,
    priority: 'medium',
    provider: 'openai',
    resetStrategy: 'rolling'
  });

  const allocation = await manager.requestTokens({
    estimatedTokens,
    estimatedCost: estimatedTokens * 0.00001, // $0.01 per 1K tokens
    model,
    provider: 'openai',
    requestType: 'completion',
    budgetId: budget.id
  });

  if (allocation.conditions) {
    // Try cheaper model
    return 'gpt-4o-mini';
  }

  return model;
}
```

### 3. Output Compression for Token Savings

```typescript
import { compressOutput } from '@agentsy/context';

function compressAssistantResponse(response: string): string {
  // Compress to 75% of original size
  return compressOutput(response, {
    level: 'full',
    preserve: {
      codeFences: true,
      inlineCode: true,
      urls: true
    }
  });
}
```

### 4. Multi-Budget Management

```typescript
import { createInMemoryTokenManager } from '@agentsy/context';

const manager = createInMemoryTokenManager();

// Create separate budgets for different models
const gpt4Budget = await manager.createBudget({
  maxCost: 50.0,
  maxTokens: 500000,
  model: 'gpt-4',
  name: 'gpt-4-budget',
  periodMs: 3600000,
  priority: 'high',
  provider: 'openai',
  resetStrategy: 'rolling'
});

const claudeBudget = await manager.createBudget({
  maxCost: 30.0,
  maxTokens: 200000,
  model: 'claude-3-5-sonnet',
  name: 'claude-budget',
  periodMs: 3600000,
  priority: 'medium',
  provider: 'anthropic',
  resetStrategy: 'rolling'
});

// Request from appropriate budget
async function requestTokens(
  model: string,
  tokens: number
): Promise<TokenAllocation> {
  const budgetId = model === 'gpt-4' ? gpt4Budget.id : claudeBudget.id;

  return await manager.requestTokens({
    budgetId,
    estimatedTokens: tokens,
    estimatedCost: tokens * 0.00001,
    model,
    provider: model === 'gpt-4' ? 'openai' : 'anthropic',
    requestType: 'completion'
  });
}
```

## Performance Characteristics

### Compression Performance

- **Output compression**: <10ms average for typical responses
- **Conversation compression**: <50ms for 100-message histories
- **Token estimation**: <1ms per message

### Memory Usage

- **In-memory token manager**: ~1MB for 100 budgets with 1000 usage records each
- **Compression**: No significant memory overhead
- **Pacing controller**: Negligible memory footprint

### Accuracy

- **Token estimation**: Conservative (never underestimates)
- **Compression preservation**: 100% accuracy for code blocks, URLs, paths
- **Budget enforcement**: Deterministic, no race conditions

## Error Handling

### Budget Errors

```typescript
import { BudgetExceededError, BudgetNotFoundError } from '@agentsy/context';

try {
  const allocation = await manager.requestTokens(request);
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.error('Budget exceeded:', error.message);
  } else if (error instanceof BudgetNotFoundError) {
    console.error('Budget not found:', error.message);
  }
}
```

### Compression Errors

```typescript
import { CompressionError, TokenEstimationError } from '@agentsy/context';

try {
  const compressed = compressOutput(text, { level: 'full' });
} catch (error) {
  if (error instanceof CompressionError) {
    console.error('Compression failed:', error.message);
  } else if (error instanceof TokenEstimationError) {
    console.error('Token estimation failed:', error.message);
  }
}
```

## Best Practices

### 1. Conservative Token Estimation

Always overestimate token counts to avoid exceeding model limits:

```typescript
const estimateTokens = (msg: Message) => {
  // Conservative: 4 chars per token (typical for English)
  return Math.ceil(msg.content.length / 4);
};
```

### 2. Preserve Critical Content

Always preserve code, URLs, and file paths in output compression:

```typescript
compressOutput(response, {
  level: 'full',
  preserve: {
    codeFences: true,
    inlineCode: true,
    urls: true
  }
});
```

### 3. Use Safety Margins

Leave buffer between budget and actual usage:

```typescript
const safeMaxTokens = model.maxInputTokens - 10000; // 10K safety margin
compressConversation(messages, { maxTokens: safeMaxTokens });
```

### 4. Monitor Budget Status

Regularly check budget status to proactively manage costs:

```typescript
const status = await manager.getBudgetStatus(budgetId);
if (status.remainingCost < status.totalCost * 0.2) {
  console.warn('Budget at 20% or less remaining');
}
```

## License

GPL-3.0-or-later - See [LICENSE.md](./LICENSE.md) for details.

## Contributing

See [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) for development roadmap.

## Related Packages

- [@agentsy/core](https://www.npmjs.com/package/@agentsy/core) - Core compression utilities
- [@agentsy/types](https://www.npmjs.com/package/@agentsy/types) - Shared type definitions
- [@agentsy/providers](https://www.npmjs.com/package/@agentsy/providers) - Provider adapters
- [@agentsy/runtime](https://www.npmjs.com/package/@agentsy/runtime) - Runtime execution
- [@agentsy/orchestrator](https://www.npmjs.com/package/@agentsy/orchestrator) - Agent orchestration
