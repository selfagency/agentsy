---
# llm-stream-parser-j0gs
title: core parser extraction thinking xml filtering and
status: in-progress
type: epic
priority: high
branch: feat/j0gs-core-parser-extraction
pr: 3
created_at: 2026-03-11T17:08:25Z
updated_at: 2026-03-11T17:38:48Z
parent: llm-stream-parser-q8qn
---

Extract and harden core parsing primitives: `ThinkingParser`, `XmlStreamFilter`, context scrub helpers, and unified XML tool-call extraction (plan sections 2, 5a, 6).

## Todo

- [ ] Port thinking parser with model tag configurability.
- [ ] Port XML scrub/filter utilities with privacy-safe defaults.
- [ ] Merge bare XML + JSON-wrapped tool-call extraction.
