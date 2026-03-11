---
# llm-stream-parser-q07e
title: Add streaming JSON parsing
status: todo
type: feature
priority: normal
created_at: 2026-03-11T22:44:50Z
updated_at: 2026-03-11T22:48:57Z
parent: llm-stream-parser-kuah
---

Add incremental JSON parser for streaming use cases. Current parseJson only works on complete text. New streamJson should yield partial objects as JSON streams in, following Vercel AI SDK's Output.object pattern.
