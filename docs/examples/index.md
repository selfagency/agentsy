# Examples

Concrete showcase workflows built with the current Agentsy package ecosystem.

## Easy

- [CLI log summarizer](./cli-log-summarizer.md) — stream model output into a terminal-friendly summary with minimal wiring.

## Intermediate

- [Node DNS blocklist workflow](./dns-blocklist.md) — ingest multiple logs, stream model output, validate schema, and update remote DNS when a source IP should be blocked.
- [Multi-provider policy gate](./multi-provider-policy-gate.md) — switch providers while keeping one normalized schema-gated automation path.

## Advanced

- [Agent tool loop with retries + continuation](./tool-loop-retries-continuation.md) — run a multi-step tool loop, retry transient failures, and resume interrupted streams with continuation prompts.
- [Stateful ops copilot backend](./stateful-ops-copilot.md) — keep conversation state, stream AG-UI events, and recover interrupted responses.
- [All-tooling end-to-end workflow](./all-tooling-end-to-end.md) — combine SSE parsing, normalization, processing, tool loop orchestration, recovery, UI state, AG-UI conversion, rendering, and gated actions.

## Notes

- These examples are illustrative architecture patterns, not product templates.
- Replace provider and infrastructure endpoints with your own environment-specific implementations.
