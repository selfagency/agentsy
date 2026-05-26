# Phase 9 — Observability & Cost Governance

**Effort:** ~12 hours  
**Milestone:** Production-debuggable; cost-governed before GA  
**Packages:** `@agentsy/observability`, `@agentsy/tokens`, `@agentsy/providers`, `@agentsy/llm-gateway`  
**Gate:** Structured logging complete; cost telemetry functional  
**Next:** Phase 10

---

## Overview

Extend Phase 0 observability foundation with structured logging, cost tracking, and production debugging tools.

---

## TASK-043: Semantic Conventions

**Location:** `packages/observability/src/spans.ts`

```typescript
export const SpanNames = {
  // Agent loop
  AGENT_RUN: 'agent.run',
  AGENT_STEP: 'agent.step',

  // LLM
  LLM_CALL: 'llm.call',
  LLM_STREAMING: 'llm.streaming',

  // Tools
  TOOL_CALL: 'tool.call',
  TOOL_EXECUTION: 'tool.execution',

  // Retrieval
  RETRIEVAL_QUERY: 'retrieval.query',
  RETRIEVAL_RERANK: 'retrieval.rerank',

  // Memory
  MEMORY_COMPACT: 'memory.compact',
  MEMORY_RETRIEVE: 'memory.retrieve',

  // Runtime
  HOOK_FIRE: 'hook.fire',
  PLUGIN_LOAD: 'plugin.load',
  CONTEXT_INJECT: 'context.inject'
};

export const SemanticAttributes = {
  llm: {
    model: 'llm.model',
    provider: 'llm.provider',
    input_tokens: 'llm.input_tokens',
    output_tokens: 'llm.output_tokens',
    latency_ms: 'llm.latency_ms',
    cost_usd: 'llm.cost_usd',
    finish_reason: 'llm.finish_reason',
    request_id: 'llm.request_id'
  },

  tool: {
    name: 'tool.name',
    args_hash: 'tool.args_hash', // Never raw args
    result_content_hash: 'tool.result_content_hash',
    latency_ms: 'tool.latency_ms',
    is_cached: 'tool.is_cached'
  },

  retrieval: {
    query_class: 'retrieval.query_class',
    sparse_hits: 'retrieval.sparse_hits',
    dense_hits: 'retrieval.dense_hits',
    rerank_score: 'retrieval.rerank_score',
    citation_count: 'retrieval.citation_count'
  },

  memory: {
    tier: 'memory.tier',
    operation: 'memory.operation',
    duration_ms: 'memory.duration_ms',
    bytes_read: 'memory.bytes_read',
    bytes_written: 'memory.bytes_written'
  }
};
```

---

## TASK-044: Token & Cost Telemetry

**Location:** `packages/tokens/src/`

```typescript
export class CostTracker {
  async trackLlmCall(provider: string, model: string, tokens: { input: number; output: number }) {
    const cost = this.computeCost(provider, model, tokens);

    this.span.setAttributes({
      'llm.cost_usd': cost,
      'llm.input_tokens': tokens.input,
      'llm.output_tokens': tokens.output
    });

    this.totalCost += cost;
    this.tracer.info('llm_call_cost', {
      provider,
      model,
      tokens,
      cost,
      totalSessionCost: this.totalCost
    });
  }

  getSessionCost(): {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  } {
    // Aggregate from spans
  }
}
```

**CLI integration:**

```bash
$ agentsy chat
> /help
[...]
> Who is Claude?
<AI response with token counts>
────────────────────────────────────
input: 234 | output: 567 | cost: $0.004
```

---

## TASK-045: Status + Trace Commands

```bash
/trace                      # Show current trace
/events                     # List recent spans/events
/terminal                   # Subprocess output
/worktrees                  # Git worktrees
```

---

## TASK-046: Redaction Defaults

**Location:** `packages/observability/src/redaction.ts`

```typescript
export class RedactionProcessor {
  process(span: Span): Span {
    // Redact secret patterns
    const redacted = { ...span };

    // Process all string attributes
    for (const [key, value] of Object.entries(redacted.attributes)) {
      if (typeof value === 'string') {
        const { redacted: text } = redactSecrets(value);
        redacted.attributes[key] = text;
      }
    }

    return redacted;
  }
}

export const SECRET_PATTERNS = {
  apiKey: /sk-[a-zA-Z0-9]{32,}/g,
  awsKey: /AKIA[0-9A-Z]{16}/g,
  githubToken: /ghp_[a-zA-Z0-9]{36}/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g
};
```

**Privacy-first defaults:**

- ✅ No plaintext secrets in logs/spans
- ✅ PII redacted before export
- ✅ Hash-based content tracking (never raw)

---

## TASK-047: Regression Tests

```typescript
test('trace completeness', async () => {
  // Run agent
  // Verify spans contain:
  // - model selected
  // - provider used
  // - tools called (with action taken)
  // - approvals requested
  // - memory injected
  // - retrieval source counts
});

test('cost accuracy', async () => {
  // LLM response: 50 input, 100 output
  // Model: gpt-4o (input $0.005/K, output $0.015/K)
  // Expected cost: 0.05*0.005 + 0.1*0.015 = $0.0005 + $0.0015 = $0.002
  // Verify tracer reports $0.002
});
```

---

## TASK-048: Production Incident Diagnosis

`docs/packages/observability.md`:

```markdown
# Diagnosing Production Issues

## High Latency

Look at span durations:
```

/trace | grep \"llm.latency_ms > 2000\"

```text

Compare to provider baseline. Check for:
- Circuit breaker (OPEN state)
- Rate limit backoff
- Model being overwhelmed

## Cost Explosion

Check cost telemetry:
```

/trace | grep \"llm.cost_usd\" | sum

```text

Top-K models by cost:
```

/events | group-by model | sort cost DESC

```text

## Memory Leaks

Watch episodic memory growth:
```

/memory stats | watch

```text

Should stabilize after compaction.

## Tool Failures

Each tool call span includes exit code:
```

/trace | grep \"tool_failed\"

```text

```

---

## Phase 9 + LLM Gateway: TASK-LB-OBS

**Location:** `packages/llm-gateway/src/metrics/`

```typescript
export class MetricsCollector {
  recordRequest(providerId: string, modelId: string, tokens: TokenCounts, latencyMs: number) {
    this.metrics.requests[providerId] ??= [];
    this.metrics.requests[providerId].push({
      modelId,
      tokens,
      latencyMs,
      timestamp: new Date()
    });
  }

  getRoutingState(): RoutingState {
    return {
      strategy: this.strategy,
      providers: this.providers.map(p => ({
        id: p.id,
        health: this.health.getStatus(p.id),
        usage: this.usage.getSnapshot(p.id),
        latencyPercentiles: this.latencies.percentiles(p.id)
      }))
    };
  }

  getUsageSnapshot(): UsageSnapshot {
    return {
      requests: this.count('requests'),
      tokens: {
        input: this.sum('input_tokens'),
        output: this.sum('output_tokens')
      },
      cost: this.sum('cost_usd'),
      failovers: this.count('failovers'),
      circuitTrips: this.count('circuit_trips'),
      byProvider: this.groupBy('provider')
    };
  }
}
```

Integrated into runtime turn loop as structured log fields (before phase 10).

---

## Quality Gates

- ✅ All spans include semantic attributes
- ✅ No plaintext secrets in any output
- ✅ Cost calculations verified against provider APIs
- ✅ Trace completeness tests passing
- ✅ Redaction processor comprehensive

---

**Next phase:** `13-PHASE-10-CONFIGURATION.md`
