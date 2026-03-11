---
# llm-stream-parser-5bmr
title: Close extraction plan gaps before Opilot integration
status: in-progress
type: task
priority: high
created_at: 2026-03-11T21:15:47Z
updated_at: 2026-03-11T21:15:47Z
parent: llm-stream-parser-q8qn
branch: feat/5bmr-close-extraction-plan-gaps-main
---

Implement remaining plan gaps in llm-stream-parser before final Opilot rollout task:
- Add ThinkingParser.forModel() convenience factory.
- Add processor thinkingTagMap support for model-specific tag pairs.
- Add buildXmlToolSystemPrompt utility export.
- Add sanitizeNonStreamingModelOutput + formatXmlLikeResponseForDisplay utilities export.
- Add validator adapter support to validateJsonSchema.
- Add tests and update exports.

## Todo
- [ ] Add thinking tag map + `ThinkingParser.forModel()`.
- [ ] Add prompt/formatting utility modules and exports.
- [ ] Add validation adapter support to `validateJsonSchema`.
- [ ] Add/expand tests for new APIs.
- [ ] Run `pnpm run check-types` and `pnpm run test`.
