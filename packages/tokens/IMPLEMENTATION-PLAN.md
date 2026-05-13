# IMPLEMENTATION-PLAN.md

## Package: @agentsy/tokens

### Overview

Token budgeting, pacing, and economic management for LLM interactions. Provides intelligent token allocation, cost tracking, and usage optimization across the @agentsy ecosystem.

### Current Status

🔄 **Rename from token-economy** - Package exists but needs renaming and full implementation

### Core Responsibilities

- Token budget management and allocation
- Cost tracking and optimization
- Response pacing and throttling
- Token usage analytics and reporting
- Provider-specific cost optimization

### Public API Design

```typescript
// Token budget configuration
export interface TokenBudget {
  id: string;
  name: string;
  provider: string;
  model: string;
  maxTokens: number;
  maxCost: number;
  period: Duration;
  resetStrategy: 'fixed' | 'rolling' | 'manual';
  priority: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

// Token usage tracking
export interface TokenUsage {
  budgetId: string;
  tokensUsed: number;
  cost: number;
  timestamp: Date;
  requestType: 'completion' | 'embedding' | 'fine-tuning';
  metadata?: Record<string, unknown>;
}

// Token manager interface
export interface TokenManager {
  // Budget management
  createBudget(config: TokenBudgetConfig): Promise<TokenBudget>;
  getBudget(id: string): Promise<TokenBudget | null>;
  updateBudget(id: string, updates: Partial<TokenBudget>): Promise<TokenBudget>;
  deleteBudget(id: string): Promise<void>;
  listBudgets(filter?: BudgetFilter): Promise<TokenBudget[]>;

  // Token allocation
  requestTokens(request: TokenRequest): Promise<TokenAllocation>;
  releaseTokens(allocationId: string, actualUsage: number): Promise<void>;

  // Usage tracking
  recordUsage(usage: TokenUsage): Promise<void>;
  getUsage(filter?: UsageFilter): Promise<TokenUsage[]>;

  // Analytics
  getCostAnalysis(period: Duration): Promise<CostAnalysis>;
  getOptimizationSuggestions(budgetId: string): Promise<OptimizationSuggestion[]>;
}

// Token allocation request
export interface TokenRequest {
  budgetId?: string;
  provider: string;
  model: string;
  estimatedTokens: number;
  priority?: 'high' | 'medium' | 'low';
  requestType: 'completion' | 'embedding' | 'fine-tuning';
  metadata?: Record<string, unknown>;
}

// Token allocation response
export interface TokenAllocation {
  id: string;
  budgetId: string;
  allocatedTokens: number;
  allocatedCost: number;
  expiresAt: Date;
  conditions?: AllocationCondition[];
}

// Pacing controller
export class PacingController {
  constructor(tokenManager: TokenManager);

  // Request pacing
  throttleRequest(request: TokenRequest): Promise<boolean>;
  getWaitTime(request: TokenRequest): Promise<Duration>;

  // Rate limiting
  updateRateLimits(provider: string, limits: RateLimit[]): Promise<void>;
  checkRateLimit(provider: string): Promise<RateLimitStatus>;

  // Adaptive pacing
  adjustPacing(feedback: PacingFeedback): Promise<void>;
}
```

### Implementation Strategy

#### Budget Management

- Hierarchical budget system (global → team → project → user)
- Automatic budget reset based on configured strategy
- Priority-based allocation when budgets conflict
- Real-time budget status monitoring

#### Cost Optimization

- Model selection based on cost/quality tradeoffs
- Response truncation to stay within budget
- Prompt optimization suggestions
- Cache cost-effective responses

#### Pacing Algorithm

- Token bucket rate limiting
- Provider-specific rate limits
- Adaptive pacing based on feedback
- Queue management for concurrent requests

#### Integration with Providers

- Automatic token counting for requests
- Cost calculation per provider/model
- Usage reporting back to providers
- Provider-specific optimizations

### Dependencies

- Internal: `@agentsy/types` - Core interfaces
- Internal: `@agentsy/providers` - Provider integration
- External: Time utilities for period calculations
- External: Database for persistence (optional)

### Test Strategy

- Budget allocation conflict scenarios
- Rate limiting edge cases
- Cost calculation accuracy
- Performance under load
- Integration with major providers

### Co-development Dependencies

- `providers` - Token counting and cost calculation
- `runtime` - Request throttling integration
- `telemetry` - Usage metrics collection
- `agentic-loop` - Budget-aware request scheduling

### Source Plan References

- `plan/agentsy-tech.md` §4.9 - Token economy management
- `plan/agentsy-providers.md` §6.1 - Provider cost optimization
- `plan/agentsy-runtime.md` §3.4 - Request pacing and throttling

### Implementation Milestones

#### Phase 1: Core Budget Management

- [ ] TokenBudget and TokenUsage interfaces
- [ ] In-memory TokenManager implementation
- [ ] Budget CRUD operations
- [ ] Basic token allocation logic
- [ ] Usage tracking and reporting

#### Phase 2: Cost Optimization

- [ ] Provider cost models
- [ ] Model selection algorithms
- [ ] Response optimization suggestions
- [ ] Cost analysis and reporting
- [ ] Budget conflict resolution

#### Phase 3: Pacing and Rate Limiting

- [ ] PacingController implementation
- [ ] Token bucket rate limiting
- [ ] Provider-specific rate limits
- [ ] Adaptive pacing algorithms
- [ ] Queue management

#### Phase 4: Advanced Features

- [ ] Hierarchical budget system
- [ ] Budget reset strategies
- [ ] High-performance persistence layer
- [ ] Analytics and insights
- [ ] CLI management tools

### Migration Notes

When renaming from `token-economy`:

- Update all imports across packages
- Migrate any existing budget data
- Update documentation and examples
- Ensure backward compatibility during transition

### File Structure

```text
packages/tokens/src/
├── index.ts                   # Public exports
├── core/
│   ├── budget.ts             # TokenBudget and TokenUsage
│   ├── manager.ts            # TokenManager interface
│   └── allocation.ts         # Token allocation logic
├── pacing/
│   ├── controller.ts         # PacingController
│   ├── rate-limit.ts         # Rate limiting algorithms
│   └── adaptive.ts           # Adaptive pacing
├── cost/
│   ├── models.ts             # Provider cost models
│   ├── optimizer.ts          # Cost optimization
│   └── analysis.ts           # Cost analysis
├── stores/
│   ├── memory.ts             # In-memory store
│   ├── database.ts           # Persistent store
│   └── index.ts              # Store factory
└── cli/
    └── commands.ts           # Budget management CLI
```

### Verification Criteria

- [ ] All budget operations are atomic
- [ ] Token allocation respects priorities and limits
- [ ] Cost calculations are accurate across providers
- [ ] Pacing prevents rate limit violations
- [ ] Performance under concurrent load
- [ ] Integration with all major providers works

### Risk Register

- **Medium**: Provider cost model accuracy and maintenance
- **Medium**: Race conditions in concurrent allocation
- **Low**: Performance with large numbers of budgets
- **Low**: Data migration from token-economy package
