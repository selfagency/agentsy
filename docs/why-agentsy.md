# Why Agentsy

Agentsy exists to provide composable infrastructure primitives for production LLM applications in TypeScript.

## Problem

Teams often rebuild the same low-level pieces repeatedly:

- Streaming response parsing
- Tool-call extraction and accumulation
- Structured output parsing/repair
- Provider normalization
- Rendering and integration surfaces

## Approach

Agentsy splits these concerns into focused packages so consumers can compose only what they need.

## Design principles

- Small, focused packages
- Strict TypeScript contracts
- ESM-first outputs
- Test-first behavior around stream edge cases
- Clear separation of implemented behavior vs roadmap planning

## Who it is for

- VS Code extension developers building chat providers
- Teams building internal agent loops and pipelines
- Contributors who need reusable stream-processing primitives
