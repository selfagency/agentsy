# Stream processing flow

This page describes the current end-to-end flow of streaming model output through the implemented Agentsy packages.

## Step 1: ingest provider data

Your application receives partial chunks, SSE frames, or provider-specific event payloads.

- Use `@agentsy/sse` when you need low-level SSE parsing.
- Use `@agentsy/normalizers` to convert provider-specific chunks into the common Agentsy event model.

## Step 2: normalize to a common event vocabulary

`@agentsy/normalizers` is the compatibility layer between providers and the rest of the ecosystem.

That lets downstream code stop caring whether a delta originally came from OpenAI, Anthropic, Gemini, or another provider-specific format.

## Step 3: process incremental events

`@agentsy/processor` is the central orchestrator.

Its current surface includes:

- `LLMStreamProcessor`
- `createProcessorEventAdapter`
- `createPipeline`
- transform helpers such as `createSmoothStream`, `createThinkingFilter`, and `createToolCallFilter`

## Step 4: extract specialized content

Depending on your use case, add targeted helpers:

- `@agentsy/thinking` for reasoning tags
- `@agentsy/tool-calls` for tool-call extraction and payload building
- `@agentsy/structured` for schema-oriented JSON parsing and repair
- `@agentsy/xml-filter` for tag filtering and privacy-oriented scrubbing
- `@agentsy/context` for context shaping and dedupe
- `@agentsy/formatting` for safe display-oriented formatting
- `@agentsy/recovery` for snapshot/continuation behavior

## Step 5: project into UI or integration surfaces

Once the stream is processed, you can send it into one or more projections:

- `@agentsy/renderers` for plain-text rendering
- `@agentsy/ui` for conversation-state updates
- `@agentsy/ag-ui` for AG-UI protocol scenarios
- `@agentsy/vscode` for editor-native experiences

## Step 6: wrap with an agent loop if needed

`@agentsy/orchestrator/agent` sits above the processing pipeline when you need multi-step tool use, stop conditions, or loop management.

## Why this shape matters

This layered structure lets you change the outer integration surface without rewriting the parsing core. That is exactly the kind of boring architectural win that saves a team from ritualized suffering later.
