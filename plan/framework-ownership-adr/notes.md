# Notes: Framework ownership ADR

## Initial observations

- `@agentsy/context` should remain a library package, not an operational shell.
- Setup/doctor flows are CLI/integration concerns.
- Hidden-agent/background-helper patterns are orchestration concerns.
- Compatibility and operational docs belong at top-level docs or host-facing packages.

## Evidence gathered

- Root README groups CLI, VS Code, connectors, and docs as outer surfaces.
- `@agentsy/plugins` already owns extensibility and A2A scaffolding.
- `@agentsy/runtime` and `@agentsy/orchestrator` already own loop/execution concerns.
- `@agentsy/vscode`, `@agentsy/mcp`, and `@agentsy/connectors` are the natural homes for host-specific integration complexity.
- `@agentsy/cli` is the canonical end-user command surface and best fit for setup/doctor UX.
- Current repo docs show some package-role drift, so the ADR should also serve as a cleanup anchor.
