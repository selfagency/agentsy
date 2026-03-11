---
# llm-stream-parser-dwjf
title: Enforce consistent error handling pattern
status: todo
type: task
priority: normal
created_at: 2026-03-11T22:45:31Z
updated_at: 2026-03-11T22:45:31Z
---

Some modules silently skip (extractXmlToolCalls), some emit warnings (processor), some throw (buildXmlToolSystemPrompt). Document the intended pattern and ensure consistency across all public functions.
