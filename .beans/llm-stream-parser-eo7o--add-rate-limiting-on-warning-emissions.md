---
# llm-stream-parser-eo7o
title: Add rate limiting on warning emissions
status: completed
type: task
priority: normal
created_at: 2026-03-11T22:44:44Z
updated_at: 2026-03-11T22:58:11Z
parent: llm-stream-parser-17er
---

Pathological input could generate unbounded warning events from the processor. Add a `maxWarnings` cap with configurable limit.
