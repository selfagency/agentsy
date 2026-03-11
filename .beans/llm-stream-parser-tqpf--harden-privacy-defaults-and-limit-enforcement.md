---
# llm-stream-parser-tqpf
title: Harden privacy defaults and limit enforcement
status: in-progress
type: feature
priority: high
created_at: 2026-03-11T17:09:32Z
updated_at: 2026-03-11T20:48:20Z
parent: llm-stream-parser-kfsw
branch: feat/tqpf-harden-privacy-defaults-limit-enforcement
---

Enforce default privacy scrub tags, override safeguards, hard limits, and warning telemetry for adversarial or oversized outputs.

## Todo

- [ ] Add parser limits for JSON depth/key count and XML nesting depth.
- [ ] Add deterministic warnings/failures for limit breaches.
- [ ] Add/expand tests for new limit enforcement paths.
- [ ] Run `pnpm run check-types` and `pnpm run test`.
