# Phase 3.5 — Gateway

**Effort:** ~8 hours  
**Scope:** Replace direct `UniversalClient` with semantic, capability-aware gateway  
**Package:** `@agentsy/gateway` (new)  
**Gate:** Failover + quota tracking working  
**Next:** Phase 4

---

## Overview

Build semantic routing layer between CLI and providers. Automatic failover, circuit-breaking, quota tracking, strategy-based selection.

**Foundation work completed in Phase 0** (TASK-LB-001..009). This phase completes remaining tasks.

---

## Completed Foundation (TASK-LB-001..009) ✅

- ✅ Package scaffold
- ✅ ProviderProfileConfigSchema (Zod)
- ✅ ProfileRegistry
- ✅ ModelAliasMap (gpt-4o, claude-opus-4, gemini-2.5-pro, llama-3.3-70b)
- ✅ ProviderRegistry with UniversalClient creation
- ✅ GatewayClient passthrough interface
- ✅ GatewayConfigSchema

**Evidence:** `packages/llm-gateway/src/` partially complete

---

## Remaining Work (TASK-LB-005, TASK-LB-010..020)

### TASK-LB-005: Built-in Provider Profiles

**Effort:** ~1.5 hours

#### Generic OpenAI-Compatible (`generic-openai.ts`)

```typescript
export const genericOpenAiProfiles: ProviderProfile[] = [
  {
    id: 'openai-compatible-v1',
    baseUrl: 'https://api.openai.com/v1',
    requestPath: '/chat/completions',
    authHeader: 'Authorization',
    authPrefix: 'Bearer',
    errorPath: 'error.message',
    modelKey: 'model'
  }
  // 15+ providers (Deepinfra, Together, Replicate, etc)
];
```

#### Tier 0 (Local)

- `ollama-local.ts` — <http://localhost:11434>
- `zai.ts` — Zero API (mock for testing)

#### Tier 1 (Major)

- `openai.ts` — gpt-4o, gpt-4-turbo, gpt-3.5-turbo
- `anthropic.ts` — claude-opus-4, claude-sonnet-4, claude-haiku
- `gemini.ts` — gemini-2.5-pro, gemini-2-flash
- `bedrock.ts` — via AWS SDK
- `mistral.ts` — mistral-large, mistral-medium
- `deepseek.ts` — deepseek-chat, deepseek-coder
- `xai.ts` — Grok-2
- `perplexity.ts` — pplx-online, pplx-sonar
- `ollama-cloud.ts` — Remote Ollama instances

#### Tier 2

- `deepinfra.ts` — Open LLM Leaderboard models

**Quality gates:**

- ✅ All profiles tested against mock responses
- ✅ Header parsing validated
- ✅ Error extraction tested

---

### TASK-LB-010: CLI Integration

**Effort:** ~1 hour

Wire `createGatewayClient()` into `packages/cli/src/providers/resolve-provider.ts`:

```typescript
import { createGatewayClient } from '@agentsy/gateway';

export async function resolveProvider(config: CliConfig) {
  const gatewayConfig = loadGatewayConfig(config);
  const client = createGatewayClient(gatewayConfig);

  // Single-provider behavior unchanged
  // Returns UniversalClient-compatible interface
  return client;
}
```

No breaking changes to CLI; gateway is transparent upgrade.

---

### TASK-LB-011: Circuit Breaker + Health Tracking

**Effort:** ~1.5 hours

```typescript
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  check(): CircuitState {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    return this.state;
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= 5) {
      this.state = 'OPEN';
    }
  }
}

export class HealthTracker {
  getStatus(providerId: string): ProviderHealthStatus {
    return {
      healthy: breaker.check() !== 'OPEN',
      state: breaker.check(),
      lastError?: this.lastError[providerId],
      uptime: this.calculateUptime(providerId)
    };
  }
}
```

---

### TASK-LB-012: Rate Limit Header Parsing

**Effort:** ~1 hour

```typescript
export function parseRateLimitHeaders(headers: Record<string, string>) {
  return {
    rpmLimit: parseInt(headers['x-ratelimit-limit-requests'] ?? '0'),
    rpmRemaining: parseInt(headers['x-ratelimit-remaining-requests'] ?? '0'),
    rpmReset: parseInt(headers['x-ratelimit-reset-requests'] ?? '0'),
    tpmLimit: parseInt(headers['x-ratelimit-limit-tokens'] ?? '0'),
    tpmRemaining: parseInt(headers['x-ratelimit-remaining-tokens'] ?? '0'),
    tpmReset: parseInt(headers['x-ratelimit-reset-tokens'] ?? '0')
  };
}

export class UsageTracker {
  parseFromResponse(headers: Record<string, string>) {
    const limits = parseRateLimitHeaders(headers);
    this.update(limits);
  }

  canMakeRequest(inputTokens: number): boolean {
    return this.remaining.tokens >= inputTokens;
  }
}
```

Support OpenAI, Anthropic, Meta, generic patterns.

---

### TASK-LB-013: Routing Strategies

**Effort:** ~1.5 hours

Implement 6 + 1 composite:

```typescript
export type RoutingStrategy =
  | 'round-robin'
  | 'weighted'
  | 'least-connections'
  | 'latency-based'
  | 'priority-fallback'
  | 'cost-based'
  | 'adaptive';

export class RoundRobinStrategy {
  selectProvider(providers: ProviderProfile[]): ProviderProfile {
    const next = this.index % providers.length;
    this.index++;
    return providers[next];
  }
}

export class WeightedStrategy {
  selectProvider(providers: ProviderProfile[]): ProviderProfile {
    // Weighted random selection
  }
}

export class AdaptiveStrategy {
  selectProvider(providers: ProviderProfile[]): ProviderProfile {
    // Composite scorer: health + latency + cost + capability match
    // Default for production
  }
}
```

---

### TASK-LB-014: Retry & Failover

**Effort:** ~1 hour

```typescript
export async function retryWithFailover<T>(
  providers: ProviderProfile[],
  operation: (p: ProviderProfile) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (const provider of providers) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation(provider);
      } catch (err) {
        if (attempt === maxRetries - 1 && provider === providers[providers.length - 1]) {
          throw new AllProvidersExhaustedError(/* diagnostic payload */);
        }
      }
    }
  }
}

export async function retryStreamWithFailover<T>(
  providers: ProviderProfile[],
  operation: (p: ProviderProfile) => ReadableStream<T>
): Promise<ReadableStream<T>> {
  // Similar but for streaming
}
```

---

### TASK-LB-015: Active Usage Probing

**Effort:** ~0.5 hours

```typescript
export interface ProbeConfig {
  usageProbe?: {
    path: string;
    interval: number;
  };
}

export async function probeUsage(provider: ProviderProfile, config: ProbeConfig): Promise<UsageSnapshot> {
  if (!config.usageProbe) return getCachedUsage(provider.id);

  const url = `${provider.baseUrl}${config.usageProbe.path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${provider.apiKey}` }
  });

  return parseUsageResponse(response, provider.id);
}
```

Example: DeepInfra `GET /v1/me/rate_limit`

---

### TASK-LB-016: CLI Status Command

**Effort:** ~0.5 hours

```text
$ agentsy lb status

Provider           Status    Model Count    RPM Remaining    TPM Remaining
─────────────────────────────────────────────────────────────────────────
openai             ✓         3              4500/5000        100k/125k
anthropic          ✓         2              4800/5000        100k/100k
ollama (local)     ✓         5              ∞                ∞
deepinfra          ⚠ HALF    10             8000/10000       400k/500k
```

Color-code status:

- ✓ Green (CLOSED)
- ⚠ Yellow (HALF_OPEN)
- ✗ Red (OPEN)

---

### TASK-LB-017: Slash Commands

**Effort:** ~0.5 hours

```text
/lb status                    — Show status table
/lb providers                 — List configured providers
/lb strategy <name>           — Switch routing strategy
/lb reset <providerId>        — Manual circuit reset
```

Register in `@agentsy/plugins` slash registry.

---

### TASK-LB-018: Unit Tests

**Effort:** ~1 hour

```typescript
describe('Gateway', () => {
  test('config validation', () => {
    /* Zod */
  });
  test('registry lookup', () => {
    /* provider/model by ID */
  });
  test('alias resolution', () => {
    /* gpt-4o → openai */
  });
  test('circuit breaker transitions', () => {
    /* CLOSED → OPEN → HALF_OPEN → CLOSED */
  });
  test('header parsing', () => {
    /* rate limits */
  });
  test('quota pre-flight', () => {
    /* can request? */
  });
  test('strategies', () => {
    /* selection deterministic */
  });
  test('failover exhaustion', () => {
    /* all fail → AllProvidersExhaustedError */
  });
});
```

---

### TASK-LB-019: E2E Integration Tests

**Effort:** ~1.5 hours

```typescript
test('429 rate limit → failover', async () => {
  // Provider A returns 429
  // Gateway retries with Provider B
  // Success
});

test('all providers exhausted', async () => {
  // All configured providers fail
  // AllProvidersExhaustedError thrown
  // Diagnostic payload includes failures
});

test('circuit breaker after 5 consecutive failures', async () => {
  // Provider fails 5x
  // Circuit opens
  // Status shows OPEN
  // /lb reset clears state
});

test('mid-session strategy change', async () => {
  // Streaming in progress
  // /lb strategy adaptive
  // Next request uses new strategy
});

test('cost-based selection', async () => {
  // Three providers: cheap, mid, expensive
  // Strategy: cost-based
  // Cheap selected first
});
```

Run with MSW mock server from Phase 1.

---

### TASK-LB-020: LLM Model Switcher

**Effort:** ~1.5 hours

Mid-conversation model switching without restart.

```typescript
// packages/llm-gateway/src/switcher.ts
export interface ModelSwitchConfig {
  model: string;
  provider?: string;  // Inferred from model if not specified
  session?: string;   // Switch for specific session
}

export class ModelSwitcher {
  private currentModel: string;
  private currentProvider: string;

  async switch(config: ModelSwitchConfig): Promise<void> {
    const provider = config.provider ?? this.resolveProvider(config.model);
    const profile = this.registry.getProfile(provider);
    const client = this.registry.createClient(profile);

    this.currentModel = config.model;
    this.currentProvider = provider;
    this.activeClient = client;
  }

  getCurrentConfig(): { model: string; provider: string } {
    return { model: this.currentModel, provider: this.currentProvider };
  }

  getSupportedModels(): ModelInfo[] {
    return this.registry.getAllModels();
  }
}
```

**CLI integration:**

```text
/model gpt-4o                    — Switch model mid-conversation
/model claude-sonnet-4-5         — Switch with auto-provider detection
/model list                      — List all available models
```

**SDK integration:**

```typescript
await agent.switchLLM({ model: 'gpt-5.2' });
await agent.switchLLM({ model: 'claude-sonnet-4-5-20250929' }, 'session-123');
```

---

### TASK-LB-021: Documentation & Exports

**Effort:** ~0.5 hours

## README.md

````markdown
# @agentsy/gateway

Semantic routing layer for multi-provider LLM access.

## Features

- **Circuit breaking** — Automatic failover on provider outages
- **Rate limit tracking** — Monitor quota across providers
- **Adaptive routing** — Smart provider selection based on latency/cost/health
- **Transparent upgrade** — Drop-in replacement for UniversalClient

## Migration Guide

```typescript
// Before
const client = new UniversalClient(config.apiKey);

// After
const client = createGatewayClient(config);
```
````

````text

...

```text

**TSDoc**: All public types + functions documented.

**Subpath exports:**

```typescript
export { createGatewayClient } from './gateway';
export { CircuitBreaker, HealthTracker } from './health';
export { ProfileRegistry, ProviderRegistry } from './registry';
export * from './types';
````

---

### TASK-LB-OBS (Phase 9 Addition): Metrics

**Scope:** OpenTelemetry integration

```typescript
export class MetricsCollector {
  recordRequest(providerId: string, modelId: string, tokens: TokenCounts) {
    // Per-provider, per-model breakdowns
    // Latency percentiles (p50, p95, p99)
    // Failover counts
    // Circuit breaker uptime
  }

  getRoutingState(): RoutingState {
    return {
      strategy: this.strategy,
      providers: this.providers.map(p => ({
        id: p.id,
        health: this.health.getStatus(p.id),
        usage: this.usage.getSnapshot(p.id)
      }))
    };
  }

  getUsageSnapshot(): UsageSnapshot {
    return {
      requests: this.metrics.request_count,
      tokens: this.metrics.token_count,
      cost: this.metrics.cost_usd,
      failovers: this.metrics.failover_count,
      circuitTrips: this.metrics.circuit_trips
    };
  }
}
```

Integrated into runtime turn loop as structured log fields (Phase 9).

### TASK-LB-022: Tier-Aware Routing Strategy

**Scope:** Extend the routing strategy system with a `tier-aware` strategy that considers task complexity when selecting providers. Instead of routing purely on latency/cost/health, this strategy routes on the **capability tier required by the task** — matching task complexity to the cheapest sufficient provider.

**Inspired by:** [opencode-model-router](https://github.com/marco-jardim/opencode-model-router) cost-ratio-aware delegation. Extended with Phase 17 local provider integration.

```typescript
// packages/gateway/src/strategies/tier-aware.ts

import type { RoutingStrategy, ProviderCandidate, RoutingContext } from '../router.js';

export interface TierAwareConfig {
  /** Map provider→tier. Unmapped providers default to 'mid'. */
  providerTiers: Record<string, TaskComplexityTier>;
  /** Map model→tier. More specific than provider-level mapping. */
  modelTiers: Record<string, TaskComplexityTier>;
  /** When true, prefer local providers (apfel/ollama/vllm) for micro/small tasks. */
  preferLocalForLowTiers: boolean;
  /** Cost ceiling per tier: { micro: 0, small: 0.001, mid: 0.01, frontier: 0.05 } */
  tierCostCeilings: Record<TaskComplexityTier, number>;
}

/**
 * Tier-aware routing strategy.
 *
 * Selection logic:
 * 1. Read taskClassification from RoutingContext (set by orchestrator/models)
 * 2. Determine minimum required tier from classification
 * 3. Filter candidates to those at or above required tier
 * 4. Among eligible candidates, prefer cheapest (lowest costRatio)
 * 5. If preferLocalForLowTiers and micro/small → prefer local providers
 * 6. Apply health/circuit-breaker filtering
 * 7. Return ranked candidates
 */
export const tierAwareStrategy: RoutingStrategy<TierAwareConfig> = {
  name: 'tier-aware',

  select(candidates: ProviderCandidate[], context: RoutingContext): ProviderCandidate[] {
    const classification = context.taskClassification;  // from models tier router
    if (!classification) {
      // Fallback to cost-based if no classification available
      return costBasedStrategy.select(candidates, context);
    }

    const requiredTier = classification.tier;
    const tierOrder: TaskComplexityTier[] = ['micro', 'small', 'mid', 'frontier'];
    const minIndex = tierOrder.indexOf(requiredTier);

    // Filter to candidates at or above required tier
    const eligible = candidates.filter(c => {
      const candidateTier = this.resolveTier(c);
      return tierOrder.indexOf(candidateTier) >= minIndex;
    });

    // Sort: prefer exact tier match (cheapest sufficient), then by cost
    return eligible.sort((a, b) => {
      const tierA = this.resolveTier(a);
      const tierB = this.resolveTier(b);
      const diffA = tierOrder.indexOf(tierA) - minIndex;
      const diffB = tierOrder.indexOf(tierB) - minIndex;
      if (diffA !== diffB) return diffA - diffB;  // prefer closer to required
      return (a.estimatedCost ?? 0) - (b.estimatedCost ?? 0);  // then cheaper
    });
  },

  resolveTier(candidate: ProviderCandidate): TaskComplexityTier { /* ... */ },
};
```

**Integration with Phase 17 (local providers):**

```typescript
// Tier resolution includes local provider detection
const DEFAULT_PROVIDER_TIERS: Record<string, TaskComplexityTier> = {
  // Local/on-device (Phase 17)
  'apfel': 'micro',
  'ollama': 'micro',
  'lm-studio': 'micro',
  'localai': 'micro',
  'vllm-local': 'micro',
  // Cloud
  'deepinfra': 'small',
  'groq': 'small',
  'together': 'small',
  'anthropic': 'mid',
  'openai': 'mid',
  'google': 'mid',
};
```

**Implementation Tasks:**

1. Add `'tier-aware'` to `RoutingStrategy` union type
2. Implement `TierAwareConfig` and `tierAwareStrategy`
3. Add `taskClassification` field to `RoutingContext`
4. Add `resolveTier()` method using provider/model tier maps
5. Register in strategy factory with config from `tiers.json`
6. Integration test: micro task → local provider, frontier task → cloud

**Testing:**

- Micro-tier task routes to local provider when available
- Small-tier task avoids frontier providers
- Fallback to cost-based when no classification in context
- Health/circuit-breaker filtering still applies after tier filtering
- Tier override via mode presets (budget/quality) works correctly

---

### TASK-LB-023: Local Provider Registration & Offload

**Scope:** Register local/on-device providers (Apfel, Ollama, vLLM) as first-class gateway providers. Enable the gateway to route micro-tier tasks to free local models instead of paid cloud endpoints.

**Depends on:** Phase 17 (APF-001..006 platform detection, APF-007 micro-tier router)

```typescript
// packages/gateway/src/providers/local/local-provider.ts

export interface LocalProviderConfig {
  type: 'apfel' | 'ollama' | 'lm-studio' | 'localai' | 'vllm';
  baseUrl: string;
  models: LocalModelInfo[];
  healthEndpoint?: string;
  maxContextTokens: number;  // safe budget (default 3000 for micro-tier)
}

export interface LocalModelInfo {
  id: string;
  family: string;
  parameterCount?: number;   // e.g. 7, 14, 70
  contextWindow: number;
  capabilities: string[];    // ['completion', 'chat', 'tools']
  quantization?: string;     // e.g. 'q4_0', 'fp16'
}

/**
 * Auto-detect local providers via Phase 17 PlatformProfile.
 * Called during gateway initialization — adds detected providers to registry.
 */
export function registerLocalProviders(
  registry: ProviderRegistry,
  platformProfile: PlatformProfile  // from Phase 17
): LocalProviderRegistrationResult {
  // 1. Check apfel availability (macOS Apple Foundation Models)
  // 2. Probe ollama at http://localhost:11434/api/tags
  // 3. Probe lm-studio at http://localhost:1234/v1/models
  // 4. Probe vllm at configured endpoint
  // 5. For each detected provider, create ProviderEntry with micro tier
  // 6. Register in gateway with circuit breaker (local → cloud fallback)
}

export interface LocalProviderRegistrationResult {
  registered: Array<{ providerId: string; type: string; models: number }>;
  skipped: Array<{ type: string; reason: string }>;
  primaryLocal: string | null;  // best available local provider
}
```

**Implementation Tasks:**

1. Implement `LocalProviderConfig` type family
2. Implement `registerLocalProviders()` with auto-detection probes
3. Create provider adapters for each local type (apfel, ollama, etc.)
4. Add circuit-breaker config: local failure → immediate cloud fallback (no half-open)
5. Integration with Phase 17 `MicroBackendSelection`
6. Add `isLocal: true` flag to `ProviderCandidate` for tier-aware routing

**Testing:**

- Ollama detection on running instance
- Apfel detection on macOS with Foundation Models
- Graceful skip when no local providers available
- Circuit breaker: local failure → cloud fallback within 1 retry
- Context token budget enforced (3000 for micro-tier)

---

## Quality Gates

- ✅ All provider profiles tested
- ✅ Circuit breaker state machine correct
- ✅ Rate limit parsing covers OpenAI/Anthropic/Meta
- ✅ All strategies tested
- ✅ Failover deterministic
- ✅ E2E with MSW passes

---

## Success Criteria

✅ Gateway transparently replaces UniversalClient  
✅ Automatic failover working  
✅ Circuit breaker preventing cascading failures  
✅ Quota tracking accurate  
✅ CLI commands (status, reset, strategy) functional

---

**Next phase:** `07-PHASE-4-ORCHESTRATION.md`
