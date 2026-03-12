---
# llm-stream-parser-od93
title: 'Phase 1: Critical Bug Fixes'
status: completed
type: epic
priority: critical
created_at: 2026-03-11T22:43:56Z
updated_at: 2026-03-11T22:56:00Z
parent: llm-stream-parser-1ly3
---

Fix 3 critical bugs: (1) ThinkingParser drops multiple thinking blocks, (2) ThinkingParser malforms nested thinking tags, (3) appendToBlockquote breaks on CRLF line endings. TDD approach — failing tests first.
