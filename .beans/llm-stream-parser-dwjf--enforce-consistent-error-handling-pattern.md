---
# llm-stream-parser-dwjf
title: Enforce consistent error handling pattern
status: done
type: task
priority: normal
created_at: 2026-03-11T22:45:31Z
updated_at: 2026-03-11T23:23:26Z
parent: llm-stream-parser-2h10
---

Some modules silently skip (extractXmlToolCalls), some emit warnings (processor), some throw (buildXmlToolSystemPrompt). Document the intended pattern and ensure consistency across all public functions.
