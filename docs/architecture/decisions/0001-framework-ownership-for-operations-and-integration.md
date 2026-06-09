# ADR 0001: Framework ownership for setup/doctor flows, orchestration helpers, and integration documentation

- **Status:** Proposed
- **Date:** 2026-06-06

## Context

Agentsy is a layered monorepo with distinct package roles:

- foundation and shaping primitives (`@agentsy/core`, `@agentsy/types`)
- runtime and orchestration (`@agentsy/runtime`, `@agentsy/orchestrator`)
- durability and long-horizon state (`@agentsy/session`, `@agentsy/memory`, `@agentsy/context`, `@agentsy/retrieval`)
- host and protocol integration (`@agentsy/plugins`, `@agentsy/vscode`, `@agentsy/mcp`, `@agentsy/connectors`)
- operator and end-user entry surfaces (`@agentsy/cli`, repository `docs/`)

The repository has repeatedly surfaced pressure to place operational product features inside lower-level library packages. Examples include:

- setup or doctor wizards for validating installation and configuration
- hidden or background helper agents that coordinate memory, planning, or repair work
- compatibility matrices for editors, runtimes, protocols, and providers
- heavyweight end-user operational documentation attached to narrow library packages

This pressure is strongest around packages like `@agentsy/context` and `@agentsy/memory`, because those packages sit near long-horizon state and therefore often become the first place where product behavior is imagined.

Without an explicit ownership rule, library packages accumulate host-specific logic, operational UX, and integration complexity that make them harder to reuse, document, test, and version.

## Decision

Agentsy will assign ownership for these concerns as follows.

### 1. Setup and doctor flows belong to `@agentsy/cli`

The canonical interactive or scriptable operator surface for setup, doctor, environment verification, and config repair will live in `@agentsy/cli`.

Package-specific code may expose reusable validation or configuration helpers, but:

- package libraries do **not** own the end-user setup experience
- package libraries do **not** own cross-package environment diagnosis
- package libraries do **not** become product shells solely to host a wizard

Library packages may provide internal helpers such as:

- config schema validation
- environment probes
- capability checks
- machine-readable diagnostics

But the user-facing command surface belongs to the CLI.

### 2. Hidden-agent and background-helper patterns belong to orchestration

Background helper roles such as historian, planner, repairer, sidekick, critic, or synthesizer are orchestration concerns.

Ownership:

- `@agentsy/orchestrator` owns helper-agent roles, scheduling policy, delegation graphs, and multi-agent coordination semantics
- `@agentsy/runtime` owns execution mechanics, lifecycle hooks, loop boundaries, and checkpointing for those orchestrated helpers
- `@agentsy/prompts` may own prompt templates or role presets used by orchestrated helpers
- `@agentsy/plugins` may expose extension points for registering helper capabilities

State-oriented packages such as `@agentsy/context`, `@agentsy/memory`, and `@agentsy/session` may expose the primitives those helpers consume, but they do not own helper-agent product behavior.

### 3. Host and harness integration complexity belongs to outer integration packages

Integration complexity tied to a concrete host, protocol, or external harness belongs to the corresponding outer-layer package:

- `@agentsy/plugins` for plugin manifests, capability negotiation, lifecycle contracts, and extension registration
- `@agentsy/vscode` for VS Code-specific integration and editor UX
- `@agentsy/mcp` for Model Context Protocol integration
- `@agentsy/connectors` for Slack, Discord, Telegram, and similar connector surfaces

Foundation and state packages must not absorb host-specific integration logic unless the behavior is truly generic and host-agnostic.

### 4. Compatibility matrices and operational documentation belong to repository docs and host-facing packages

Compatibility guidance for:

- runtimes
- editors
- protocol consumers
- connectors
- providers
- installation surfaces

belongs in repository-level `docs/` and, where needed, in the relevant host-facing package README.

Library packages should document only the operational facts required to use their API correctly:

- behavioral guarantees
- runtime assumptions
- serialization constraints
- performance characteristics
- failure semantics

They should not become the primary home for broad operator guidance unless they ship a real operator-facing product surface such as a CLI or server.

### 5. `@agentsy/context` remains a library package

`@agentsy/context` specifically is classified as a context-shaping library package. It may own:

- conversation compression
- output compression
- drift and coherence helpers
- manual compaction artifacts
- rewind and hydration helpers
- context observability primitives directly tied to its shaping operations

It does **not** own:

- setup or doctor UX
- host compatibility matrices
- editor or harness integration behavior
- hidden-agent orchestration
- heavyweight end-user operational runbooks

## Alternatives considered

### Alternative A: Let each package own its full end-user experience

This was rejected because it encourages duplicated setup flows, fragmented diagnostics, and inconsistent operational documentation across the monorepo.

### Alternative B: Put all product behavior into the state packages

This was rejected because packages like `@agentsy/context` and `@agentsy/memory` would become difficult to reason about, too host-aware, and harder to reuse outside a single product shell.

### Alternative C: Centralize everything at repository root docs only

This was rejected because integration-specific packages still need local documentation for their host-specific surfaces. The correct split is repository docs for framework-wide guidance plus package-local docs for host-specific implementation detail.

## Consequences

### Positive

- lower-level packages stay reusable and easier to test
- setup and doctor UX can be made consistent across the framework
- orchestration semantics have a clear home instead of leaking into memory or context packages
- integration-specific complexity stays at the outer layers where it belongs
- repository documentation can present one coherent operator story

### Negative

- package authors must resist the temptation to ship end-user workflows directly from lower-level packages
- `@agentsy/cli` may need to grow into a more capable integration and diagnostics surface
- some packages will need to expose machine-readable diagnostics rather than directly implementing a human-facing doctor flow

### Follow-up implications

- update package docs that currently imply different ownership boundaries
- keep the package catalog and architecture docs aligned with real package roles
- prefer library primitives + CLI integration over package-local wizards
- treat hidden helper-agent patterns as orchestrator/runtime features, not as state-package features

## Boundary rules

When deciding where a new feature belongs, use this check:

1. If the feature is an end-user or operator command, prefer `@agentsy/cli`.
2. If it coordinates helper agents or background roles, prefer `@agentsy/orchestrator` and `@agentsy/runtime`.
3. If it adapts to a specific host or protocol, prefer `@agentsy/plugins`, `@agentsy/vscode`, `@agentsy/mcp`, or `@agentsy/connectors`.
4. If it only manipulates context, memory, session, or retrieval data in a host-agnostic way, it may belong in the corresponding library package.
5. If documentation is broad, operational, or compatibility-oriented, prefer repository `docs/` plus the relevant host-facing package README.
