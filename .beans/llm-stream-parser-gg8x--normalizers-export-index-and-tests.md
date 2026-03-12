---
# llm-stream-parser-gg8x
title: Normalizers export, index, and tests
status: todo
type: task
priority: medium
created_at: 2026-03-12T00:14:58Z
updated_at: 2026-03-12T00:15:21Z
parent: llm-stream-parser-nl5r
---

- Create `src/normalizers/index.ts` — re-export all normalizers
- Add `normalizers/` to `src/index.ts` star-export
- Write tests for each normalizer (`src/normalizers/normalizers.test.ts`)
- Verify exports work: `import { normalizeOpenAIChatChunk, ... } from 'llm-stream-parser'`

Plan ref: Phase 1, Step 1.8
