---
# llm-stream-parser-tcfp
title: Integrate parser package in Opilot with rollout gates
status: todo
type: task
priority: high
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T21:27:40Z
parent: llm-stream-parser-n4wg
blocked_by:
    - llm-stream-parser-hb9y
    - llm-stream-parser-wh4j
    - llm-stream-parser-1omz
---

Wire feature-flagged integration in Opilot, run dual-path parity checks, and validate staged rollout/rollback criteria.

## Todo
- [ ] Add `llm-stream-parser` dependency and feature flag wiring in Opilot.
- [ ] Integrate parser package in streaming and non-streaming output paths.
- [ ] Add dual-path parity checks/tests and rollout guardrails.
- [ ] Run relevant Opilot validation (`check-types`, tests) and summarize results.
