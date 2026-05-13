# @agentsy/tokens — Implementation Plan

## Role in Framework Ecosystem

`@agentsy/tokens` is the **economic governor** of the framework. It manages the token lifecycle, from budgeting and cost estimation to real-time pacing and usage analytics. It ensures that agent workflows stay within user-defined financial and rate limits, preventing runaway costs and provider-level throttling.

It is consumed by `@agentsy/core/universal-client` (for usage recording) and `@agentsy/runtime` (for pre-call budget checks).

### Ecosystem Sketch

```text
[ @agentsy/runtime ] <--- Budget Check
         |
         v
[ @agentsy/core ] <--- Usage Record
         |
         v
[ @agentsy/tokens ] <--- Accounting & Pacing
         |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
 [ Cost Tables ]         [ Pacing Logic ]        [ Audit Log ]
 (JSON/TOML)             (Rate Limiting)         (Usage History)
```

## Fulfillment of Role

The package fulfills its role by implementing a centralized token management system:

1. **Budget Enforcement**: Atomic decrement of token/cost balances on each call.
2. **Cost Tracking**: Maintaining up-to-date pricing maps for all supported providers and models.
3. **Pacing/Throttling**: Implementing token-per-minute (TPM) and request-per-minute (RPM) governors.
4. **Analytics**: Exposing per-agent, per-session, and per-model cost summaries.

## Detailed Functionality

### 1. Budget Management (`src/budgets/`)

- **Mechanism**: `TokenBudget` with configurable reset strategies.
- **Strategies**:
  - `fixed`: Reset at the start of each period (hour/day/month).
  - `rolling`: Sliding window reset.
  - `manual`: User-triggered reset only.
- **Priority Tiers**: High-priority tasks can borrow from lower-priority budgets with an audit trail.

### 2. Cost Calculation (`src/cost/`)

- **Responsibility**: Mapping usage to USD.
- **Mechanism**: Provider-specific cost tables (data-driven, no code changes for price updates).
- **Functionality**: Handles different pricing for input, output, and specialized operations (e.g., fine-tuning, embeddings).

### 3. Pacing & Throttling (`src/pacing/`)

- **Responsibility**: Protecting provider rate limits.
- **Mechanism**: Token-per-second and request-per-second rate governors with burst headroom.
- **Key Logic**: Rejects or delays requests if the predicted usage exceeds the remaining rate budget.

## Priorities

1. **Token Counting** — integrate high-fidelity token counting for all supported models (OpenAI, Anthropic, Gemini, etc.).
2. **Budget Management** — implement strict enforcement of token and cost budgets per session/user.
3. **Rate Limiting** — provide adaptive throttling to stay within provider quotas.
4. **Cost Optimization** — analysis of per-provider/model/user costs to enable intelligent model routing (OpenAgent pattern).
5. **PacingController** — adaptive request throttling and dead-time utilization (advanced).

## Logic & Data Flow

### 1. Pre-call Budget Flow

1. Before dispatching an LLM request, `@agentsy/runtime` calls `TokenManager.checkBudget()`.
2. The manager estimates the cost based on the expected token count.
3. If insufficient, the request is rejected with a `BudgetExceededError`.
4. If sufficient, the estimated amount is "reserved".

### 2. Post-call Recording Flow

1. Upon completion, `@agentsy/core/universal-client` passes the actual `usage` metrics to `TokenManager.recordUsage()`.
2. The manager updates the actual balance and releases the "reservation".
3. The usage is appended to the audit log and emitted as an event for observability.

## Key Interfaces

### TokenManager

```typescript
export interface TokenManager {
  createBudget(config: TokenBudget): Promise<void>;
  recordUsage(usage: TokenUsage): Promise<void>;
  checkBudget(request: TokenRequest): Promise<boolean>;
  resetBudget(budgetId: BudgetId): Promise<void>;
  getAnalytics(filter: AnalyticsFilter): Promise<TokenAnalytics>;
}
```

### TokenBudget

```typescript
export interface TokenBudget {
  id: BudgetId;
  provider: string;
  model: string;
  maxTokens: number;
  maxCost: number;
  period: 'hourly' | 'daily' | 'monthly';
  resetStrategy: 'fixed' | 'rolling' | 'manual';
  priority: number;
}
```

## Implementation Details

### Data-Driven Cost Tables

Model pricing should be stored in a versioned JSON or TOML file within the package. This allows the community to submit PRs for price updates without touching the core logic.

### Integration with Observability

Token usage must be emitted as attributes on every tracing span. This allows for cost-per-trace visualization in `@agentsy/observability`.

## Sources Synthesized

`agentsy-prd.md`, `agentsy-tech.md`, `provider-capability-matrix.md`, `packages/tokens/IMPLEMENTATION-PLAN.md`.

checkRateLimit(provider: string): Promise<RateLimitStatus>;

// Adaptive pacing
adjustPacing(feedback: PacingFeedback): Promise<void>;
}

````text

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
````

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

---

## Alignment Snapshot (migrated from `plan/alignment-report-5-11-26.md`)

- Token/protocol cleanup status captured as complete in the alignment report.
- Canonical naming reconciliation note preserved: legacy `token-economy` references must stay mapped to `@agentsy/tokens`.
- Runtime AG-UI protocol export path noted as `@agentsy/runtime/ag-ui` in the same alignment source.

---

## Package Naming Snapshot (migrated from `plan/PACKAGE-NAMING-MAP.md`)

- `token-economy` → `tokens` rename is final.
- `pacing` responsibilities are consolidated in `@agentsy/tokens`.
- No migration aliases/wrapper packages: use direct imports only (`@agentsy/tokens`).

---

## Extracted Technical API Surface (from `plan/agentsy-tech.md`)

### Cost-tracker convergence

`agentsy-tech.md` described a standalone `@agentsy/cost-tracker` package. In current topology, cost/budget/pacing concerns are consolidated into `@agentsy/tokens`.

### Consolidated API responsibilities

- Usage recording: prompt/completion/total token accounting.
- USD cost mapping by provider/model pricing table.
- Session + model breakdown summaries.
- Budget threshold events and pacing integration.

### Interface targets

```typescript
interface CostTrackerLike {
  record(usage: { promptTokens: number; completionTokens: number; modelId: string; providerId: string }): void;
  getSummary(): CostSummary;
  reset(): void;
}
```
