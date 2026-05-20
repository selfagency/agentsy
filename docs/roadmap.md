# Roadmap

This roadmap tracks implementation direction against the canonical plan in `plan/MASTER-IMPLEMENTATION-PLAN.md`.

## Status of sandbox isolation

- [✅] `VirtualSandbox` moved to `worker_threads` (or compatible async execution) to prevent main-thread hangs.
- [✅] `VirtualSandbox` supports hard timeouts with automatic termination.
- [🔄] `ContainerSandbox` (Rivet) promoted from 'Investigation' to 'Implementation'.
- [🔄] Drafting `RivetSandbox` provider for the `SandboxRouter`.
- [✅] Implemented virtual sandbox with hybrid architecture supporting both virtual first and container fallback.

## Snapshot (May 2026)

### Established package foundations

The monorepo has active manifest-backed packages for:

- core processing (`@agentsy/core`)
- providers (`@agentsy/providers`)
- orchestration/runtime (`@agentsy/orchestrator`, `@agentsy/runtime`)
- session/memory/tokens (`@agentsy/session`, `@agentsy/memory`, `@agentsy/tokens`)
- integrations/surfaces (`@agentsy/vscode`, `@agentsy/cli`, `@agentsy/ui`, `@agentsy/renderers`)
- platform support packages (`@agentsy/types`, `@agentsy/tools`, `@agentsy/plugins`, `@agentsy/observability`, `@agentsy/prompts`, `@agentsy/secrets`)

### Plan-only domains to promote

The following domains exist as implementation plans but are not yet manifest-backed packages:

- connectors
- guardrails
- mcp
- retrieval

## Execution priorities

### Priority 1 — boundary consistency and hardening

- Keep core/providers boundaries explicit and consistent in code/docs.
- Continue package-level implementation plan execution on manifest-backed packages.
- Preserve runtime/orchestrator split and session durability invariants.

### Priority 2 — domain promotion

Promote plan-only domains into full package units:

1. `packages/connectors`
2. `packages/guardrails`
3. `packages/mcp`
4. `packages/retrieval`

Each promotion includes:

- package manifest and exports
- build/typecheck/test integration
- migration and package docs updates

### Priority 3 — cross-domain integration quality

- tighten provider fallback/routing behavior
- strengthen runtime approval/policy controls
- deepen memory/retrieval integration surfaces
- maintain observability and token-governance feedback loops

## Quality gates

All roadmap work is gated by:

- `pnpm build`
- `pnpm check-types`
- `pnpm test`

And by architecture governance:

- no circular dependency regressions
- no stale package-boundary claims in docs
- package-level plans and master plan kept in sync for boundary-impacting changes

## What changed recently

- `plan/agentsy-platform-v2.md` was retired after consolidation.
- Master planning authority moved to `plan/MASTER-IMPLEMENTATION-PLAN.md`.
- Roadmap now reflects repository reality (manifest-backed vs plan-only domains) rather than historical package assumptions.
