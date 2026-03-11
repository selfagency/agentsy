---
# llm-stream-parser-h4s1
title: Port parser primitives with behavioral parity tests
status: in-progress
type: task
priority: high
branch: feat/h4s1-parser-primitives-parity
pr: 4
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T17:38:48Z
parent: llm-stream-parser-zkyu
blocked_by:
    - llm-stream-parser-af18
---

Port thinking/context/tool-call parser primitives from Opilot and verify parity via focused unit/snapshot tests.

## Todo

- [x] Unblock dependency by validating `llm-stream-parser-af18` completion status and updating linkage if needed.
- [ ] Port `ThinkingParser` behavior from Opilot and add focused parity tests.
- [ ] Port context/XML helpers (`splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`) and add parity tests.
- [ ] Port XML tool-call extraction parity behavior and add tests for known-tools filtering and malformed/whitespace variants.
- [ ] Run safe validation checkpoints: type-check, focused tests, then full `src` test run.
