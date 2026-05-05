# Package inventory

This page maps each package to its role in the overall Agentsy framework.

## Published

- `@agentsy/vscode` — VS Code chat-provider integration utilities.

## Internal / pre-release

- `@agentsy/types` — shared type contracts.
- `@agentsy/sse` — server-sent-event parsing.
- `@agentsy/thinking` — reasoning tag extraction.
- `@agentsy/xml-filter` — XML/privacy filtering.
- `@agentsy/context` — context extraction and dedupe helpers.
- `@agentsy/tool-calls` — tool-call extraction/accumulation.
- `@agentsy/structured` — JSON parse/repair/validation.
- `@agentsy/normalizers` — provider payload normalizers.
- `@agentsy/processor` — event-driven stream orchestration.
- `@agentsy/recovery` — stream snapshots + continuation prompts.
- `@agentsy/renderers` — plain/CLI/Ink rendering components.
- `@agentsy/ui` — conversation state/event-store helpers.
- `@agentsy/ag-ui` — AG-UI protocol bridging utilities.
- `@agentsy/agent` — multi-step agent loop.
- `@agentsy/adapters` — adapter helpers for integration surfaces.
- `@agentsy/formatting` — text-formatting helpers.

## Private

- `@agentsy/integration` — cross-package integration tests.

## Notes

- Internal/pre-release packages are documented for contributors and early adopters.
- Planned packages and future work are tracked in [Roadmap](./roadmap.md) and `plan/`.
