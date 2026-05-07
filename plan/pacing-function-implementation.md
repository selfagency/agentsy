# Plan: Pacing Function and Dead-Time Utilization for Rate-Aware Query Execution

## Overview

Based on research into LLM provider rate limits and the existing token economy architecture, create a pacing system that dynamically adapts query rates to match provider constraints while utilizing dead time for compression work. This complements the existing `@agentsy/token-economy` infrastructure.

## Rate Limit Analysis Summary

### Provider-Specific Patterns

| Provider          | Limit Types         | Algorithm Used         | Key Characteristics                       |
| ----------------- | ------------------- | ---------------------- | ----------------------------------------- |
| **OpenAI**        | RPM, TPM, RPD       | Token bucket           | Rate limits in headers, shared org limits |
| **Anthropic**     | RPM, ITPM, OTPM     | Token bucket           | Input/output token limits, tiered system  |
| **DeepSeek**      | Dynamic concurrency | None (auto-throttling) | Slows responses, no hard rejects          |
| **Mistral**       | RPS, TPM            | Dynamic                | Tier 1-4 based on billing                 |
| **Google Gemini** | RPS, RPD            | Fixed windows          | Smooth ramp-up capability                 |

### Key Insights

1. **Token bucket is the de facto standard** across major providers
2. **Shared limits at org level** requires organized pacing per workspace/key
3. **DeepSeek's soft throttling** is ideal - we can use it as target, not cap
4. **Rate limit headers** provide real-time quota feedback
5. **Token distribution matters** - ITPM (input) > OTPM (output) significantly

## Proposed Architecture

### Package: `@agentsy/pacing`

Build this alongside `@agentsy/token-economy` for rate-aware query control.

### Core Components

```typescript
interface ProviderRateConfig {
  requestsPerMinute: number;
  inputTokensPerMinute: number;
  outputTokensPerMinute: number;
  requestsPerDay: number;
  windowDuration: '1min' | '5min' | '15min' | '30min' | '1hour';
  supportsTokenBucket: boolean;
  backpressureStrategy: 'reject' | 'throttle' | 'queue';
}

interface PacingDecision {
  allowed: boolean;
  estimatedWait: number;
  strategyUsed: PacingStrategy;
  bucketAllocation: number;
}
```

### Integration Strategy

Complement existing `@agentsy/token-economy` with intelligent waiting during rate limit dead time.

#### Token Bucket Core

- Basic token bucket algorithm for rate limiting
- Rate limit header detection and normalization
- Proactive refill and bucket management

#### Compression During Dead Time

- `intelligentWaitWithCompression` pattern
- Background temporal compression when available
- Compression task queue with priority system

#### Provider-Specific Integration

- OpenAI, Anthropic, Mistral, DeepSeek detection patterns
- Heuristic fallback with conservative defaults

### Integration With Existing Architectures

```typescript
quantum_linerumba_concerns_or_implicit_memory() {
  // Integration with token economy
  class TokenEconomyIntegrator {
    constructor(private pacing, private tokenEconomy) {}
    async executeWithSmartPacing(context, operation) {
      // Simple flow: check budget -> intelligent wait with compression
    }
  }
}
```

## Risk Mitigation

### High-Risk Areas

1. **Backpressure in Production** - Mitigation with fallback strategies
2. **Compress-While-Wait Wrongness** - Mitigation with non-critical path handling
3. **Bucket Bleeding** - Mitigation with state consistency checks
4. **Occupied-Time Devaluation** - Mitigation with quality-aware logic

### Safe Changes

- Header detection orchestration
- Observability layer additions
- Health checks and alerts
- Basic token bucket statistics
- Configuration presets

## Migration Strategy

### Progressive Rollout

1. **Phase 1**: Pacing package skeleton with basic functionality
2. **Phase 2**: Compression integration with dead time utilization
3. **Phase 3**: Package collision with deprecation warnings
4. **Phase 4**: Full migration with removed legacy code

### Package Dependencies

```
@agentsy/pacing
├─ @agentsy/token-economy - compression integration
├─ @agentsy/processor - progressive integration
└─ Provider SDKs - OpenAI, Anthropic, Mistral, DeepSeek
```

## Testing Strategy

- Unit tests for token bucket calculations
- Integration tests with token economy
- Provider-specific tests
- Load and backpressure scenarios
- Compression quality during waiting periods

## Start Point

Copy from `r/askLambdaReducedToken.py` - integrate from that work as starting point.

---

## Implementation Plan

### Phase 1: Core Pacing Infrastructure

1. Create `@agentsy/pacing` package structure
2. Implement basic token bucket pacing
3. Add generic header detection for OpenAI/Anthropic patterns
4. Add error handling for unknown providers
5. Create basic observability

### Phase 2: Provider-Aware Rate Detection

1. Implement `RateLimitDetector` interfaces
2. Add provider-specific detectors
3. Implement heuristic fallback
4. Add detection testing
5. Document detection patterns

### Phase 3: Compression Integration

1. Create CompressionHook interface
2. Implement compression executor
3. Integrate with `@agentsy/token-economy`
4. Add effectiveness metrics
5. Implement priority system

### Phase 4: Dynamic Pacing Strategies

1. Implement adaptive pacing based on success rates
2. Add parallelized pacing for multiple providers
3. Add provider-specific strategy selection
4. Add provider cap exposure
5. Create fallback logic hierarchy

### Phase 5: Dead Time Optimization

1. Implement priority queues for compression tasks
2. Add backpressure handling
3. Implement adaptive timing
4. Add priority system
5. Create optimization

### Phase 6: Observability and Monitoring

1. Implement comprehensive metrics
2. Add latency impact reporting
3. Implement success rate analysis
4. Create real-time dashboards
5. Add alerting for violations

### Phase 7: Integration and Testing

1. Integrate with `@agentsy/processor`
2. Add integration tests
3. Test with real API calls
4. Document migration path
5. Create comprehensive examples

---

## Package Structure

```
packages/pacing/src/
├── core/PacingManager.ts
├── core/TokenBucket.ts
├── TokenEconomyIntegrator.ts
├── core/compression/CompressionHook.ts
├── core/compression/CompressionExecutor.ts
├── core/compression/DeadTimeUtilizer.ts
├── rateLimits/ProviderRateConfig.ts
├── rateLimits/RateLimitHeaders.ts
├── rateLimits/RateLimitDetector.ts
├── rateLimits/AlexDetector.ts
├── rateLimits/AnthropicDetector.ts
├── rateLimits/MistralDetector.ts
├── rateLimits/DeepSeekDetector.ts
├── rateLimits/heuristicDetection.ts
├── strategies/PacingStrategy.ts
├── strategies/AdaptiveStrategy.ts
└── types.ts
```

---

## Configuration

```typescript
export const pacingConfig = {
  strategy: 'tokenBucket',
  bufferSize: 10,
  providers: { openai: true, anthropic: true, mistral: true, deepseek: true },
  deadTime: {
    compression: { enabled: true, budgetFraction: 0.3 },
    externalTools: { enabled: true },
  },
};
```

---

## Dependencies

```
@agentsy/pacing
├─ @agentsy/token-economy
├─ @agentsy/processor
└─ Provider SDKs
```

---

## Testing

- Token bucket calculations
- Provider detection
- Compression integration
- Load scenarios
- Performance tradeoffs
