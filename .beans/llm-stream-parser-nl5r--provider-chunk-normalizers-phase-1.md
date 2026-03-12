---
# llm-stream-parser-nl5r
title: Provider Chunk Normalizers (Phase 1)
status: todo
type: milestone
priority: high
created_at: 2026-03-12T00:14:19Z
updated_at: 2026-03-12T00:14:19Z
id: llm-stream-parser-nl5r
---
Transform-only normalizers that convert raw provider-specific JSON objects to the library's `StreamChunk` type. No HTTP client — users bring their own transport.

Covers OpenAI (Chat Completions + Responses API), Anthropic/Claude SSE, Ollama NDJSON, Gemini, and Mistral.

See: docs/developers/gap-implementation-plan.md — Phase 1
