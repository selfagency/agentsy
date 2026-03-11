---
# llm-stream-parser-j0gs
title: core parser extraction thinking xml filtering and tool-call extraction
status: completed
type: epic
priority: high
branch: feat/j0gs-core-parser-extraction
pr: 3
created_at: 2026-03-11T17:08:25Z
updated_at: 2026-03-11T17:58:44Z
parent: llm-stream-parser-q8qn
---

Extract and harden core parsing primitives: `ThinkingParser`, `XmlStreamFilter`, context scrub helpers, and unified XML tool-call extraction (plan sections 2, 5a, 6).

## Todo

- [x] Port thinking parser with model tag configurability.
- [x] Port XML scrub/filter utilities with privacy-safe defaults.
- [x] Merge bare XML + JSON-wrapped tool-call extraction.

## Summary of Changes

- Delivered core parser primitive extraction through feature `llm-stream-parser-zkyu`.
- Completed parity ports for thinking parser, XML/context filtering helpers, and tool-call extraction.
- Added focused parity tests and validated with full type-check and test runs.
