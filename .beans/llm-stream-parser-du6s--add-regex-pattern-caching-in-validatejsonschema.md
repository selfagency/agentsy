---
# llm-stream-parser-du6s
title: Add regex pattern caching in validateJsonSchema
status: todo
type: task
priority: low
created_at: 2026-03-11T22:45:35Z
updated_at: 2026-03-11T22:45:35Z
---

Regex patterns in validateJsonSchema are compiled on every validation call. Add a simple LRU cache or pre-compilation option for repeated validations with the same schema.
