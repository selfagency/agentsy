---
# llm-stream-parser-ayp9
title: Schema Validation & Format Builders (Phase 4)
status: completed
type: milestone
priority: normal
created_at: 2026-03-12T00:14:42Z
updated_at: 2026-03-13T00:18:34Z
---

JSON Schema validation enhancements and provider-specific response format builders.

See: docs/developers/gap-implementation-plan.md — Phase 4

## Todo

- [x] Step 4.1: Enhance validateJsonSchema (oneOf/anyOf/allOf/not/const/$defs/$ref/format)
- [x] Step 4.2: Create src/structured/providerFormats.ts (OpenAI, Ollama, Gemini builders)
- [x] Step 4.3: Tests for all Phase 4 features
- [x] Update barrel exports (src/structured/index.ts)
