# Roadmap

This page summarizes where the broader Agentsy platform is heading.

## Read this page carefully

Everything below is roadmap context unless it is explicitly called out as already implemented in `packages/`.

## What is already real

The current repo already implements the lower layers of the platform:

- provider normalization
- stream processing and transforms
- structured-output parsing and repair
- tool-call parsing
- conversation-state helpers
- renderer primitives
- a VS Code integration package

Those layers are documented in the [Architecture overview](./architecture/index.md) and [Package catalog](./packages.md).

## Major planned tracks

### Runtime expansion

Planning documents point toward additional runtime-oriented packages and capabilities, including:

- richer agent runtime/session concepts
- memory and retrieval primitives
- provider-management and MCP-oriented layers
- more explicit lifecycle and telemetry surfaces

Primary sources:

- `plan/agentsy-tech.md`
- `plan/agentsy-platform-v2.md`

### Feature platform expansion

The planning set also sketches a larger feature ecosystem around agent applications, including:

- slash commands
- skills
- caveman-mode style productivity layers
- superpowers and workflow automation concepts
- connector ecosystems and product-specific integrations

Primary sources:

- `plan/agentsy-features-v1.md`
- `plan/agentsy-connectors-v1.md`
- `plan/agentsy-agents-v1.md`

### Product surfaces

Several plan documents explore how these packages support product-facing experiences beyond low-level infrastructure, such as standalone apps and integration-first developer tooling.

Primary sources:

- `plan/agentsy-standalone-v1.md`
- `plan/agentsy-prd.md`

## Documentation policy for planned work

This docs site follows three guardrails:

1. **Current APIs are documented from code that exists now.**
2. **Planned packages are described as architecture or roadmap only.**
3. **Future-facing pages link back to the plan docs instead of inventing stable API references early.**

That keeps the platform story useful without turning into vaporware fan fiction. The silicon deserves better.

## Best next reads

- [Architecture overview](./architecture/index.md)
- [Platform evolution](./architecture/platform-evolution.md)
- [Package catalog](./packages.md)
