---
# llm-stream-parser-zkyu
title: Extract core parser primitives from Opilot
status: completed
type: feature
priority: high
created_at: 2026-03-11T17:09:32Z
updated_at: 2026-03-11T18:53:26Z
---

Port `ThinkingParser`, `XmlStreamFilter`, context scrub helpers, and unified XML tool-call extraction with parity to current behavior.

## Todo

- [x] Inventory source implementations and test coverage in Opilot (`thinkingParser.ts`, `formatting.ts`, `toolUtils.ts`).
- [x] Scaffold target modules in `llm-stream-parser` (`thinking/`, `xml-filter/`, `tool-calls/`, `context/`) with exports.
- [x] Port `ThinkingParser` with tag configurability and add parity tests.
- [x] Port `XmlStreamFilter` + scrub helpers (`splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`) and add parity tests.
- [x] Port unified XML tool-call extraction (bare XML + JSON-wrapped) and add parity tests.
- [x] Run targeted tests and type-check; update bean checklist with outcomes.

## Summary of Changes

- Completed scaffold and parity inventory for core parser primitive extraction.
- Ported and tested `ThinkingParser` behavior with tag configurability and chunk-boundary handling.
- Ported and tested XML/context helpers and streaming scrub filter behavior.
- Ported and tested unified XML tool-call extraction for both bare XML and JSON-wrapped formats.
