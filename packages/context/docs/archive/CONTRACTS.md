# @agentsy/context - API Contracts

This document defines the stable API contracts for the context package.

## Core Contracts

### Token Budget Management

```typescript
interface TokenBudget {
  id: string;
  maxCost: number;
  maxTokens: number;
  metadata?: Record<string, unknown>;
  model: string;
  name: string;
  periodMs: number;
  priority: 'high' | 'medium' | 'low';
  provider: string;
  resetStrategy: 'fixed' | 'rolling' | 'manual';
}

interface TokenAllocation {
  allocatedCost: number;
  allocatedTokens: number;
  budgetId: string;
  conditions?: AllocationCondition[];
  expiresAt: Date;
  id: string;
}

interface AllocationCondition {
  kind: 'budget' | 'rate-limit';
  message: string;
}
```

### Token Usage Tracking

```typescript
interface TokenUsage {
  budgetId: string;
  cost: number;
  metadata?: Record<string, unknown>;
  model: string;
  provider: string;
  requestType: 'completion' | 'embedding' | 'fine-tuning';
  timestamp: Date;
  tokensUsed: number;
}

interface TokenRequest {
  budgetId?: string;
  estimatedCost?: number;
  estimatedTokens: number;
  metadata?: Record<string, unknown>;
  model: string;
  priority?: 'high' | 'medium' | 'low';
  provider: string;
  requestType: 'completion' | 'embedding' | 'fine-tuning';
}
```

### Compression API

```typescript
interface CompressionOptions<TMessage> {
  maxTokens: number;
  preserveLast?: number;
  estimateTokens: (message: TMessage) => number;
}

interface CompressionResult<TMessage> {
  retained: TMessage[];
  droppedCount: number;
  estimatedTokens: number;
}

interface OutputCompressionOptions {
  level?: 'lite' | 'full' | 'ultra';
  preserve?: Partial<OutputPreserveOptions>;
}

interface OutputPreserveOptions {
  codeFences: boolean;
  inlineCode: boolean;
  urls: boolean;
}
```

### Error Taxonomy

```typescript
// Budget Errors
class BudgetExceededError extends Error {
  constructor(budgetId: string, requested: number, available: number);
}

class BudgetNotFoundError extends Error {
  constructor(budgetId: string);
}

class InvalidBudgetConfigError extends Error {
  constructor(field: string, value: unknown);
}

// Allocation Errors
class AllocationFailedError extends Error {
  constructor(reason: string, conditions?: AllocationCondition[]);
}

class AllocationExpiredError extends Error {
  constructor(allocationId: string);
}

// Compression Errors
class CompressionError extends Error {
  constructor(message: string, details?: unknown);
}

class TokenEstimationError extends Error {
  constructor(message: string);
}
```

## Invariants

1. **Budget Enforcement**: Token allocations never exceed budget limits
2. **Allocation Expiration**: Allocations expire after their defined period
3. **Compression Safety**: Compressed content preserves critical elements (code, URLs, paths)
4. **Token Accuracy**: Token estimates are conservative (never underestimate)
5. **Cost Tracking**: All token usage is recorded with cost metadata

## Versioning Policy

- **Major version (X.0.0)**: Breaking changes to contracts or error types
- **Minor version (0.X.0)**: New features, backward-compatible additions
- **Patch version (0.0.X)**: Bug fixes, performance improvements

## Stability Guarantees

The following APIs are considered **stable** and will not break without a major version bump:

- `createInMemoryTokenManager()`
- `compressConversation()`
- `compressOutput()`
- `createTokenLedger()`
- `PacingController`

The following APIs are **experimental** and may change in minor versions:

- Internal compression algorithms
- Token estimation heuristics
- Budget reset strategies
