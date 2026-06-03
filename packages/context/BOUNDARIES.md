# @agentsy/context - Package Boundaries

This document defines the boundaries and integration points between `@agentsy/context` and other packages in the agentsy ecosystem.

## Package Responsibilities

### Core Responsibilities (OWNED)

1. **Token Budget Management**
   - Budget creation, allocation, and enforcement
   - Token usage tracking and reconciliation
   - Cost estimation and analysis
   - Rate limiting and pacing

2. **Context Compression**
   - Conversation history compression
   - Output compression with preservation rules
   - Token estimation for compression decisions

3. **Budget Policy Engine**
   - Hard/soft limit enforcement
   - Priority-based allocation
   - Reset strategy implementation

### Out of Scope (NOT OWNED)

- **Model-specific tokenization** → `@agentsy/providers`
- **Provider pricing data** → `@agentsy/providers`
- **Runtime enforcement middleware** → `@agentsy/runtime`
- **Orchestrator integration** → `@agentsy/orchestrator`
- **Observability/metrics** → `@agentsy/observability`
- **Memory persistence** → `@agentsy/memory`

## Dependencies

### Required Dependencies

```typescript
// @agentsy/core - Compression utilities
import { compressProse, protectPattern } from '@agentsy/core/context';
import type { CompressionLevel } from '@agentsy/core/context';

// @agentsy/types - Shared types
import type { StreamChunk } from '@agentsy/types';
```

### Dependency Rationale

**@agentsy/core/context**:

- Provides shared compression utilities (`compressProse`, `protectPattern`)
- Exports `CompressionLevel` type for output compression
- Avoids duplication of compression logic across packages

**@agentsy/types**:

- Provides shared type definitions
- Ensures type consistency across packages
- Avoids circular dependencies

## Integration Points

### With @agentsy/runtime

**Runtime calls context for:**

- Budget enforcement before LLM requests
- Token allocation for requests
- Usage recording after responses
- Rate limiting and pacing

**Context provides:**

- `createInMemoryTokenManager()` - Token budget manager
- `PacingController` - Rate limiting with backoff
- `compressConversation()` - Context truncation

**Contract:**

```typescript
// Runtime → Context
interface BudgetEnforcementRequest {
  estimatedTokens: number;
  model: string;
  provider: string;
  budgetId?: string;
}

interface BudgetEnforcementResponse {
  allowed: boolean;
  allocation?: TokenAllocation;
  conditions?: AllocationCondition[];
}
```

### With @agentsy/orchestrator

**Orchestrator calls context for:**

- Budget-aware agent scheduling
- Token cost tracking across agents
- Priority-based resource allocation

**Context provides:**

- `createInMemoryTokenManager()` - Multi-budget management
- Cost analysis APIs
- Budget summary generation

**Contract:**

```typescript
// Orchestrator → Context
interface AgentSchedulingRequest {
  agentId: string;
  estimatedTokens: number;
  priority: BudgetPriority;
  model: string;
}

interface AgentSchedulingResponse {
  scheduled: boolean;
  budgetId?: string;
  allocation?: TokenAllocation;
}
```

### With @agentsy/providers

**Providers calls context for:**

- Token counting for provider-specific models
- Cost estimation based on provider pricing
- Model-specific budget routing

**Context provides:**

- Token estimation interfaces
- Budget configuration schemas
- Cost analysis summaries

**Contract:**

```typescript
// Providers → Context
interface TokenCountRequest {
  content: string;
  model: string;
  provider: string;
}

interface TokenCountResponse {
  tokenCount: number;
  estimatedCost: number;
}
```

### With @agentsy/observability

**Observability calls context for:**

- Budget usage metrics
- Cost tracking data
- Allocation condition telemetry

**Context provides:**

- `TokenUsage` records
- `CostAnalysis` summaries
- `BudgetStatus` queries

**Contract:**

```typescript
// Context → Observability
interface BudgetTelemetry {
  budgetId: string;
  usage: TokenUsage[];
  status: BudgetStatus;
  allocations: TokenAllocation[];
}
```

## Data Flow Boundaries

### Request Flow

```text
User Request
    ↓
Runtime (estimate tokens)
    ↓
Context (check budget, allocate tokens)
    ↓
Providers (execute request)
    ↓
Context (record usage)
    ↓
Runtime (return response)
```

### Budget Enforcement Flow

```text
LLM Request
    ↓
Runtime → Context.requestTokens()
    ↓
Context: Check budget limits
    ↓
Context: Apply priority rules
    ↓
Context: Return allocation or rejection
    ↓
Runtime: Proceed or reject request
```

### Compression Flow

```text
Conversation History
    ↓
Context: Estimate tokens
    ↓
Context: Check budget
    ↓
Context: Drop oldest messages if needed
    ↓
Context: Return compressed history
    ↓
Runtime: Send to LLM
```

## API Stability

### Stable APIs (v0.2.0+)

- `createInMemoryTokenManager()`
- `compressConversation()`
- `compressOutput()`
- `createTokenLedger()`
- `PacingController`

### Experimental APIs

- Internal compression algorithms
- Token estimation heuristics
- Budget reset strategies

## Version Compatibility

### @agentsy/core

- **Minimum version**: 0.2.0
- **Required exports**: `./context` subpath
- **Breaking changes**: Major version bump required

### @agentsy/types

- **Minimum version**: 0.1.1
- **Required exports**: Core type definitions
- **Breaking changes**: Major version bump required

## Testing Boundaries

### Unit Tests (OWNED)

- Budget policy enforcement
- Token allocation logic
- Compression algorithms
- Reset strategies
- Priority handling

### Integration Tests (SHARED)

- Runtime enforcement middleware
- Orchestrator budget integration
- Provider token counting
- Observability telemetry

### End-to- Tests (SHARED)

- Full request lifecycle
- Multi-agent budget coordination
- Cost tracking accuracy

## Migration Guide

### For Consumers

**v0.1.x → v0.2.0**:

- `workspace:*` dependencies → `peerDependencies`
- Import paths unchanged
- API contracts stable

**Breaking Changes**:

- None in v0.2.0

### For Maintainers

**Adding New Features**:

1. Update `CONTRACTS.md`
2. Add unit tests
3. Update this boundaries document
4. Bump minor version

**Breaking Changes**:

1. Update `CONTRACTS.md`
2. Update this boundaries document
3. Bump major version
4. Update consumer documentation
