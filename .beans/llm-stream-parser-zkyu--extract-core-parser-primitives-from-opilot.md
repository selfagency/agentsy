---
# llm-stream-parser-zkyu
title: Extract core parser primitives from Opilot
status: in-progress
type: feature
priority: high
branch: feat/zkyu-extract-core-parser-primitives
created_at: 2026-03-11T17:09:32Z
updated_at: 2026-03-11T17:26:22Z
parent: llm-stream-parser-j0gs
---

Port `ThinkingParser`, `XmlStreamFilter`, context scrub helpers, and unified XML tool-call extraction with parity to current behavior.

## Todo

- [ ] Inventory source implementations and test coverage in Opilot (`thinkingParser.ts`, `formatting.ts`, `toolUtils.ts`).
- [x] Scaffold target modules in `llm-stream-parser` (`thinking/`, `xml-filter/`, `tool-calls/`, `context/`) with exports.
- [ ] Port `ThinkingParser` with tag configurability and add parity tests.
- [ ] Port `XmlStreamFilter` + scrub helpers (`splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`) and add parity tests.
- [ ] Port unified XML tool-call extraction (bare XML + JSON-wrapped) and add parity tests.
- [ ] Run targeted tests and type-check; update bean checklist with outcomes.
