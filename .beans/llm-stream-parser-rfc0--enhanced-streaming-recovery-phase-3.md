---
# llm-stream-parser-rfc0
title: Enhanced Streaming & Recovery (Phase 3)
status: in-progress
type: milestone
priority: normal
created_at: 2026-03-12T12:27:55Z
updated_at: 2026-03-12T22:51:56Z
---

Enhanced partial JSON field-by-field streaming, stream error recovery utilities, and usage/token tracking.

See: docs/developers/gap-implementation-plan.md — Phase 3

## Todo

- [x] Step 3.3: Usage/token tracking (ProcessedOutput, AccumulatedMessage, StreamEventMap)
- [x] Step 3.1: Field-by-field partial JSON streaming (streamJson.ts)
- [x] Step 3.2: Stream error recovery utilities (src/recovery/index.ts)
- [x] Step 3.4: Tests for all Phase 3 features
- [x] Update barrel exports (src/index.ts)
