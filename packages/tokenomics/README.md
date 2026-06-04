# @agentsy/tokenomics

Token budget management, rate limiting, and spend accountability for LLM applications.

## Installation

```bash
npm install @agentsy/tokenomics @agentsy/types @agentsy/core
```

## Quick Start

### Create and Use a Budget

```typescript
import { createInMemoryTokenManager } from '@agentsy/tokenomics';

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
const usage = await manager.getUsage({ budgetId: budget.id });
const spent = usage.reduce((sum, u) => sum + u.tokensUsed, 0);
console.log(`Spent ${spent} tokens, budget remaining: ${budget.maxTokens - spent}`);
```

### Multi-Budget Management

```typescript
import { createInMemoryTokenManager } from '@agentsy/tokenomics';

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
  maxTokens: 200_000,
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
    estimatedCost: tokens * 0.00001, // $0.01 per 1K tokens
    model,
    provider: model === 'gpt-4' ? 'openai' : 'anthropic',
    requestType: 'completion'
  });
}
```

### Rate Limiting

```typescript
import { PacingController } from '@agentsy/tokenomics';

const controller = new PacingController(createInMemoryTokenManager());
controller.updateRateLimits('openai', [{ maxRequests: 1, windowMs: 1000 }]);

// Check if request should be throttled
const waitTime = controller.getWaitTime({
  estimatedTokens: 10,
  model: 'gpt-4.1-mini',
  provider: 'openai',
  requestType: 'completion'
});

if (waitTime > 0) {
  console.log(`Rate limited, waiting ${waitTime}ms`);
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

// Check rate limit status
const status = controller.checkRateLimit('openai');
if (!status.allowed) {
  console.log('Request would be rate limited');
}
```

## API Reference

### createInMemoryTokenManager

Creates an in-memory token budget manager.

```typescript
function createInMemoryTokenManager(): TokenManager
```

**Returns:** Token manager instance with methods:

- `createBudget(config)`: Create a new budget
- `deleteBudget(id)`: Delete a budget
- `getBudget(id)`: Get budget details
- `getCostAnalysis(periodMs)`: Get cost analysis for a time window
- `getOptimizationSuggestions(budgetId)`: Get optimization suggestions
- `getUsage(filter)`: Get usage records
- `listBudgets(filter)`: List all budgets
- `recordUsage(usage)`: Record token usage
- `releaseTokens(allocationId, actualUsage, actualCost)`: Release reservation and record usage
- `requestTokens(request)`: Request token allocation
- `updateBudget(id, updates)`: Update budget config

### PacingController

Rate limiting controller with adaptive pacing.

```typescript
class PacingController {
  constructor(tokenManager: TokenManager)
  throttleRequest(request): Promise<boolean>
  getWaitTime(request): number
  updateRateLimits(provider, limits): void
  checkRateLimit(provider): RateLimitStatus
  adjustPacing(feedback): void
  tokenManager(): TokenManager
}
```

### Related Packages

- [@agentsy/core](https://www.npmjs.com/package/@agentsy/core) - Core compression utilities
- [@agentsy/types](https://www.npmjs.com/package/@agentsy/types) - Shared type definitions
- [@agentsy/context](https://www.npmjs.com/package/@agentsy/context) - Compression, drift detection, output shaping
- [@agentsy/providers](https://www.npmjs.com/package/@agentsy/providers) - Provider adapters
- [@agentsy/runtime](https://www.npmjs.com/package/@agentsy/runtime) - Runtime execution
- [@agentsy/orchestrator](https://www.npmjs.com/package/@agentsy/orchestrator) - Agent orchestration
