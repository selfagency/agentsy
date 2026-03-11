---
# llm-stream-parser-rebm
title: Add Zod schema integration
status: todo
type: feature
priority: normal
created_at: 2026-03-11T22:44:54Z
updated_at: 2026-03-11T22:48:57Z
parent: llm-stream-parser-kuah
---

Add Zod as optional peer dependency for schema definition. Create zodAdapter.ts with helpers to convert Zod schemas to JSON Schema for use with existing validateJsonSchema. Follow pattern from Anthropic/OpenAI/Vercel SDKs.
