---
# llm-stream-parser-q8qn
title: LLM Stream Parser extraction and Opilot rollout
status: in-progress
type: milestone
priority: high
branch: feat/q8qn-parser-extraction-hierarchy
pr: 1
created_at: 2026-03-11T17:08:11Z
updated_at: 2026-03-11T17:12:30Z
---

Implement the parser extraction plan in `docs/plans/parser-extraction.plan.md` by delivering a reusable `llm-stream-parser` package, integrating it back into Opilot, and validating parity/security before default enablement.

## Definition of Done

- Extracted package API and modules implemented.
- Opilot integration behind a feature flag with rollback path.
- Security/privacy guards and hard limits enforced.
- Test parity and rollout gates satisfied.

## Todo

- [x] Create and link all epics, features, and tasks from the plan.
- [x] Prioritize and sequence execution order.
- [x] Start first implementation item.
