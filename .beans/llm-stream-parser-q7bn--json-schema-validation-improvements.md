---
# llm-stream-parser-q7bn
title: JSON Schema validation improvements
status: todo
type: feature
priority: medium
created_at: 2026-03-12T00:16:58Z
updated_at: 2026-03-12T00:17:03Z
parent: llm-stream-parser-ayp9
id: llm-stream-parser-q7bn
---

Enhance `src/structured/validateJsonSchema.ts`:

- Add `oneOf` support: exactly one sub-schema must match
- Add `anyOf` support: at least one sub-schema must match
- Add `allOf` support: all sub-schemas must match
- Add `not` support: sub-schema must NOT match
- Add `const` support: value must equal const exactly
- Add `$defs` / `$ref` support: resolve local references (`#/$defs/Foo`)
- Add string `format` validation: `date`, `date-time`, `email`, `uri`, `uuid`, `ipv4`, `ipv6`
- Keep existing depth/key limits and ReDoS protections
- NOT adding: remote `$ref` resolution (SSRF risk)

Plan ref: Phase 4, Step 4.1
