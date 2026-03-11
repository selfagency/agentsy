---
# llm-stream-parser-76fs
title: Add ReDoS protection for schema patterns
status: todo
type: task
priority: high
created_at: 2026-03-11T22:44:32Z
updated_at: 2026-03-11T22:44:32Z
---

validateJsonSchema compiles user-provided regex patterns with no safety checks. Pathological patterns could hang the process. Add prominent JSDoc warning and optionally a regex complexity check or timeout.
