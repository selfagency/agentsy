---
# llm-stream-parser-ufii
title: Add automated retry/repair loop
status: todo
type: feature
priority: normal
created_at: 2026-03-11T22:44:58Z
updated_at: 2026-03-11T22:44:58Z
---

Current buildRepairPrompt generates a prompt but doesn't execute the loop. Add repairWithLLM utility that takes a callback and retries, following LangChain's OutputFixingParser/RetryParser pattern.
