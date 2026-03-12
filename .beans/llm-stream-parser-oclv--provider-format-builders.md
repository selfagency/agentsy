---
# llm-stream-parser-oclv
title: Provider format builders
status: todo
type: feature
priority: medium
created_at: 2026-03-12T00:16:58Z
updated_at: 2026-03-12T00:17:03Z
parent: llm-stream-parser-ayp9
id: llm-stream-parser-oclv
---

Create `src/structured/providerFormats.ts` with:

- `buildOpenAIResponseFormat(schema, options?)` → `{ type: "json_schema", json_schema: { name, strict, schema } }`
- `buildOllamaFormat(schema)` → JSON schema directly (Ollama's `format` parameter)
- `buildGeminiResponseSchema(schema)` → `{ responseMimeType: "application/json", responseSchema: ... }`
- Pure data transformers — no API calls

Plan ref: Phase 4, Step 4.2
