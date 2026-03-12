---
# llm-stream-parser-ufii
title: Add automated retry/repair loop
status: completed
type: feature
priority: normal
created_at: 2026-03-11T22:44:58Z
updated_at: 2026-03-11T23:09:18Z
parent: llm-stream-parser-kuah
---

Current buildRepairPrompt generates a prompt but doesn't execute the loop. Add repairWithLLM utility that takes a callback and retries, following LangChain's OutputFixingParser/RetryParser pattern.
