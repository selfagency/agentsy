# Observability — Production Troubleshooting

> ⚠️ `/trace` and `/events` are placeholder commands. Real span emission requires wiring a `MetricsCollector` or `CostTracker` into the runtime. The examples below show the intended output format once observability is connected.

## Prerequisites

Ensure the observability engine is initialized:

```typescript
import { createObservabilityEngine } from '@agentsy/observability';

const obs = createObservabilityEngine({
  serviceName: 'agentsy-runtime',
  sampling: 'always_on'
});
```

## High Latency

Check LLM span durations:

```text
/trace | grep llm.latency_ms
```

Compare to provider baseline:

| Provider | Expected P50 | Expected P95 |
|----------|-------------|-------------|
| OpenAI GPT-4o | <1000ms | <3000ms |
| Anthropic Claude | <1500ms | <4000ms |
| Mistral Large | <800ms | <2500ms |

**Common causes:**

- Circuit breaker in OPEN state — check `/lb status`
- Rate limit backoff — check `llm.finish_reason` = `rate_limit`
- Large context window — check `llm.input_tokens`

## Cost Explosion

Monitor cost per session via `CostTracker`:

```typescript
const tracker = new CostTracker({ span });
// After each LLM call:
tracker.trackLlmCall('openai', 'gpt-4o', { input: 500, output: 1500 });
const cost = tracker.getSessionCost();
```

**Red flags:**

- Infinite retry loop on tool failures
- Unbounded agent delegation with no cost cap
- Model fallback to expensive tier under load

## Memory Leaks

Watch episodic memory growth:

```text
/memory stats
```

Should stabilize after compaction (~10-15 min). Monitored attributes:

- `memory.bytes_read` — KB loaded per query
- `memory.bytes_written` — KB stored per turn

## Tool Failures

Check tool span exit codes:

```text
/trace | grep tool_failed
```

**Common patterns:**

- `status: cancelled` — user or security hook blocked execution
- `status: error` — tool threw during execution
- Missing `rerank_score` — retrieval pipeline returned no results

## Redaction Verification

Verify no secrets in span output:

```bash
# Should produce no matches
/trace | grep 'sk-[a-zA-Z0-9]'
/trace | grep 'ghp_[a-zA-Z0-9]'
```

## What to Check First

1. `/trace` — Are spans being emitted? If empty, observability engine is not wired.
2. `/events` — Are LLM calls recorded with tokens/cost?
3. `/lb status` — Are any providers in circuit-breaker OPEN state?
4. `/memory stats` — Is memory growth bounded?
