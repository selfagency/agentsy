---
# llm-stream-parser-oclv
title: Provider format builders
status: completed
type: feature
priority: medium
created_at: 2026-03-12T00:16:58Z
updated_at: 2026-03-13T01:28:16Z
parent: llm-stream-parser-ayp9
---

Create `src/structured/providerFormats.ts` with provider-specific JSON schema format builders.

## Todo

- [x] `buildOpenAIResponseFormat(schema, options?)` — OpenAI `response_format` object
- [x] `buildOllamaFormat(schema)` — Ollama schema (direct JSON Schema pass-through)
- [x] `buildGeminiResponseSchema(schema)` — Gemini `responseSchema` + `responseMimeType`
