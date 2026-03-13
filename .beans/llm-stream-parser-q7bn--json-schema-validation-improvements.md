---
# llm-stream-parser-q7bn
title: JSON Schema validation improvements
status: completed
type: feature
priority: medium
created_at: 2026-03-12T00:16:58Z
updated_at: 2026-03-13T01:28:16Z
parent: llm-stream-parser-ayp9
---

Enhance `src/structured/validateJsonSchema.ts` with additional JSON Schema keywords.

## Todo

- [x] `const` — deep equality check
- [x] `not` — sub-schema must NOT match
- [x] `anyOf` — at least one sub-schema must match
- [x] `oneOf` — exactly one sub-schema must match
- [x] `allOf` — all sub-schemas must pass
- [x] `$defs`/`$ref` — local `#/$defs/Foo` resolution with circular ref detection
- [x] String `format` — date, date-time, email, uri, uuid, ipv4, ipv6
