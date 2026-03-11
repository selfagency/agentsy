---
# llm-stream-parser-h4s1
title: Port parser primitives with behavioral parity tests
status: completed
type: task
priority: high
branch: feat/h4s1-parser-primitives-parity
pr: 4
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T17:57:51Z
parent: llm-stream-parser-zkyu
---

Port thinking/context/tool-call parser primitives from Opilot and verify parity via focused unit/snapshot tests.

## Todo

- [x] Unblock dependency by validating `llm-stream-parser-af18` completion status and updating linkage if needed.
- [x] Port `ThinkingParser` behavior from Opilot and add focused parity tests.
- [x] Port context/XML helpers (`splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`) and add parity tests.
- [x] Port XML tool-call extraction parity behavior and add tests for known-tools filtering and malformed/whitespace variants.
- [x] Run safe validation checkpoints: type-check, focused tests, then full `src` test run.

## Summary of Changes

- Ported `ThinkingParser` state-machine behavior with configurable opening/closing tags and parity test coverage.
- Ported XML/context filtering helpers (`createXmlStreamFilter`, `splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`) with parity-focused tests.
- Ported unified XML tool-call extraction supporting both bare XML and JSON-wrapped `toolCall`/`tool_call` formats.
- Added and updated focused unit tests; final validation state is green (`check-types`, focused suites, and full `pnpm test`).
