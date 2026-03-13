---
# llm-stream-parser-ecgt
title: Phase 4 tests (schema validation, format builders)
status: in-progress
type: task
priority: normal
created_at: 2026-03-12T00:17:12Z
updated_at: 2026-03-13T01:34:46Z
---

Write tests for all Phase 4 features in `src/structured/structured.test.ts`.

## Todo

- [ ] const validation (match, mismatch, null, array)
- [ ] not validation (type and const variants)
- [ ] anyOf validation (match first, match later, no match, multi-match)
- [ ] oneOf validation (exactly one, zero, two match)
- [ ] allOf validation (all pass, one fail, error accumulation)
- [ ] $defs/$ref resolution (valid, not-found, remote, circular, unanchored)
- [ ] String format: date, date-time, email, uri, uuid, ipv4, ipv6 (valid + invalid)
- [ ] Provider format builders: buildOpenAIResponseFormat, buildOllamaFormat, buildGeminiResponseSchema
