---
# llm-stream-parser-kfsw
title: security privacy and resilience hardening
status: completed
type: epic
priority: high
created_at: 2026-03-11T17:08:24Z
updated_at: 2026-03-11T20:55:15Z
parent: llm-stream-parser-q8qn
---

Enforce privacy-safe defaults, hard limits, warning telemetry, and threat-model-driven safeguards (plan sections 11 and 11.1).

## Todo
- [x] Enforce scrub-tag and privacy guarantees.
- [x] Implement hard limits across parsing paths.
- [x] Add warning/reporting hooks and deterministic failures.

## Summary of Changes
- Completed through feature `llm-stream-parser-tqpf` and tasks `llm-stream-parser-1omz` + follow-up hard-limit work.
- Enforced privacy tags by default, override safeguards, and warning telemetry.
- Added hard limits for input size, XML nesting depth, tool call count/size, and JSON depth/key constraints with tests.
