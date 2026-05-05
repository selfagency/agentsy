---
layout: home

hero:
  name: Agentsy
  text: Composable infrastructure for production-grade LLM systems
  tagline: Build headless agentic workflows in Node.js-compatible runtimes, align with open standards like MCP and AG-UI, and add UI layers only when you actually need them.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Explore packages
      link: /packages
    - theme: alt
      text: Used in VS Code
      link: /#used-by
    - theme: alt
      text: View on GitHub
      link: https://github.com/selfagency/agentsy
      target: _blank
      rel: noreferrer

features:
  - icon: 🔌
    title: Provider normalization
    details: Convert incompatible provider payloads into a shared stream vocabulary before the rest of your stack ever sees them.
    link: /packages/normalizers
    linkText: See normalizers
  - icon: 🌊
    title: Streaming-first processing
    details: Handle chunk boundaries, partial outputs, reasoning tags, tool-call deltas, and finish states as first-class concerns.
    link: /packages/processor
    linkText: See processor
  - icon: 🧰
    title: Focused utility packages
    details: Adopt only the layers you need for structured output, context cleanup, SSE parsing, recovery, formatting, and XML scrubbing.
    link: /packages
    linkText: Browse package catalog
  - icon: 🤖
    title: Headless-first agent runtime
    details: Build multi-step loops, state stores, protocol bridges, renderers, and CLI or operator-style workflows without requiring a frontend, TUI, or web app first.
    link: /architecture/package-ecosystem
    linkText: See the architecture
  - icon: 🌐
    title: Open stack, not a captive ecosystem
    details: Agentsy aims to align with open standards and credible interoperability efforts like MCP, AG-UI, and skills-style workflows instead of forcing developers into one vendor-owned world.
    link: /why-agentsy
    linkText: Read the rationale
  - icon: 🧭
    title: Honest roadmap boundaries
    details: This site separates what ships today from what is planned so teams can adopt the current packages without mistaking roadmap material for runtime reality.
    link: /roadmap
    linkText: Read the roadmap
  - icon: 🛡️
    title: Type-safe and defensive
    details: Agentsy treats model output as untrusted input and is built around strict TypeScript contracts, bounded parsing, and recoverable streaming behavior.
    link: /why-agentsy
    linkText: Why Agentsy exists
---

<div id="used-by"></div>

## Used today in VS Code Copilot Chat

Agentsy already powers third-party model support in three published VS Code extensions for GitHub Copilot Chat:

| Extension                                                                                                   | What it brings into Copilot Chat                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Opilot](https://marketplace.visualstudio.com/items?itemName=selfagency.opilot)                             | Ollama models with tool support, vision support, streaming, and local-model workflows |
| [Z.ai for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.z-models-vscode)          | Z.ai coding models with tool calling, streaming, and MCP-assisted capabilities        |
| [Mistral for Copilot](https://marketplace.visualstudio.com/items?itemName=selfagency.mistral-models-vscode) | Mistral AI models with streaming, tool calling, and vision support                    |

That means this package family is already doing real work in editor-native integrations — not just waiting around in a roadmap wearing a fake mustache.

## Start here

### Evaluate the framework

- Read [Why Agentsy](/why-agentsy)
- Skim the [architecture overview](/architecture/)
- Browse the [package catalog](/packages)

## Why this stack exists

Agentsy is meant for developers building agentic tools that need dependable runtime plumbing more than flashy first-party surfaces:

- headless workflows running in Node.js-compatible runtimes
- CLI and operator tooling
- editor integrations and coding agents
- standards-aware systems that want to work with open ecosystem protocols instead of a captive vendor stack

### Adopt the current packages

- Follow [Getting started](/getting-started)
- Use the [API index](/api)
- If you came from the old monolith, use [Migrating from `@selfagency/llm-stream-parser`](/migrating-from-llm-stream-parser)

### Contribute to the monorepo

- Open the [developer guide](/developers/)
- Review the [roadmap](/roadmap)
- Cross-check future-facing work against the `plan/` documents referenced throughout the architecture pages

## Package status model

Agentsy documentation uses three labels consistently:

| Status        | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| **Published** | Public package with an installable npm release today      |
| **Private**   | Repo-internal package used for verification or tooling    |
| **Planned**   | Described in `plan/`, not yet implemented as package code |

## Recommended reading path

1. [Why Agentsy](/why-agentsy)
2. [Architecture overview](/architecture/)
3. [Stream processing flow](/architecture/stream-processing)
4. [Package catalog](/packages)
5. [API index](/api)

## Planning sources

The platform narrative on this site is grounded in these planning documents:

- `plan/agentsy-prd.md`
- `plan/agentsy-tech.md`
- `plan/agentsy-platform-v2.md`
- `plan/agentsy-features-v1.md`

Those documents inform future-facing pages, but they are not treated as evidence that a package or API already ships.
