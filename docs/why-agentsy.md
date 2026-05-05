# Why Agentsy

Agentsy exists so teams do not have to keep rebuilding the same LLM plumbing from scratch every quarter and then pretending it was a strategic decision.

## The problem it solves

Modern LLM features usually need the same set of hard, boring, failure-prone building blocks:

- streaming provider response parsing
- normalization across incompatible provider payloads
- structured-output parsing and repair
- tool-call accumulation across partial chunks
- renderer and UI integration surfaces
- state management around multi-step loops

Many libraries solve one slice. Most applications need several slices composed together.

## The Agentsy approach

Agentsy organizes those concerns into focused packages that can be adopted independently or composed into a larger stack.

At a high level, the ecosystem looks like this:

1. **Normalize** provider-specific payloads into a shared stream vocabulary.
2. **Process** the stream into stable events and transforms.
3. **Extract and validate** tool calls, structured data, and reasoning tags.
4. **Project** the stream into renderers, state stores, or product-specific integrations.
5. **Loop** on top of the pipeline when you need agent behavior.

## Why package boundaries matter here

Agentsy is intentionally not a single monolith anymore.

That gives teams a few advantages:

- adopt only the layers you need
- test lower-level parsing independently from runtime behavior
- keep VS Code and product-specific code out of foundation packages
- evolve roadmap concepts without pretending they already belong in every runtime

## Design principles

- **Composable over monolithic** — package boundaries mirror real concerns.
- **Strict TypeScript contracts** — model output is treated as untrusted input.
- **Streaming-first** — chunk boundaries, malformed partials, and recovery paths are first-class concerns.
- **Integration-aware** — UI, renderer, and editor surfaces are documented as consumers of the processing stack, not magical exceptions.
- **Honest roadmap language** — planned packages stay labeled planned until they exist.

## Who this ecosystem is for

- teams building internal LLM products that need reusable parsing and orchestration primitives
- extension authors building chat providers or editor-native AI experiences
- contributors who want a layered TypeScript foundation for future runtime, memory, MCP, or connector work

## Where to go next

- [Getting started](./getting-started.md)
- [Architecture overview](./architecture/index.md)
- [Package catalog](./packages.md)
- [Roadmap](./roadmap.md)
