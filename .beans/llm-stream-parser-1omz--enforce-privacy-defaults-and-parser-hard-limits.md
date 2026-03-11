---
# llm-stream-parser-1omz
title: Enforce privacy defaults and parser hard limits
status: completed
type: task
priority: high
branch: feat/1omz-enforce-privacy-defaults
pr: 13
created_at: 2026-03-11T17:09:45Z
updated_at: 2026-03-11T17:09:53Z
parent: llm-stream-parser-tqpf
blocked_by:
    - llm-stream-parser-hb9y
---

Implement privacy-safe scrub defaults, unsafe-override warnings, and hard limits for inputs/depth/tool payload counts.

## Todo

- [x] Add explicit privacy tag set and enforce it by default even with scrub overrides.
- [x] Emit deterministic warnings when unsafe override or truncation/limit behavior is applied.
- [x] Enforce hard limits for tool calls per message and tool argument payload size.
- [x] Add/expand unit tests for privacy enforcement and hard limits.
- [x] Run `pnpm run check-types` and `pnpm run test`.

## Summary of Changes

- Added `PRIVACY_TAG_NAMES` and ensured `DEFAULT_SCRUB_TAG_NAMES` explicitly includes privacy tags.
- Updated `createXmlStreamFilter()` to enforce privacy tags by default even when `overrideScrubTags` is provided, with warning telemetry when unsafe overrides are corrected.
- Added processor hard limits for `maxToolCallsPerMessage` and `maxToolArgumentBytes`, with deterministic warning emissions.
- Added regression tests for privacy enforcement behavior and processor tool-call limit handling.
- Verified with full package validation: `pnpm run check-types` and `pnpm run test`.
