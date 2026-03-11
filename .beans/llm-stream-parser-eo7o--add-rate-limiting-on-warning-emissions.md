---
# llm-stream-parser-eo7o
title: Add rate limiting on warning emissions
status: todo
type: task
priority: normal
created_at: 2026-03-11T22:44:44Z
updated_at: 2026-03-11T22:48:51Z
parent: llm-stream-parser-17er
---

Pathological input could generate unbounded warning events from the processor. Add a `maxWarnings` cap with configurable limit.
