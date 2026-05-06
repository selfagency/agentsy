# API index

This page is a link-first map of the currently available APIs.

Detailed API breakdowns, examples, and composition guidance live on the individual package pages under `docs/packages/`. This page helps you find the right package quickly instead of forcing every export detail into one long reference blob.

## Status notes

- **Published** means the package is live on npm now.
- **Private** means the package is repo-internal.
- Future agentic tooling described in `plan/` remains roadmap material until package code exists.

## Runtime and orchestration

- [`@agentsy/processor`](./packages/processor.md) — `LLMStreamProcessor`, `createProcessorEventAdapter`, `ToolCallParser`, `ZAiInlineToolCallParser`, `createPipeline`, `createSmoothStream`, `createThinkingFilter`, `createToolCallFilter`
- [`@agentsy/normalizers`](./packages/normalizers.md) — `normalizeOpenAIChatChunk`, `normalizeOpenAIResponseEvent`, `normalizeAnthropicEvent`, `normalizeGeminiChunk`, `normalizeMistralChunk`, `normalizeOllamaChatChunk`, `normalizeOpenAICompatibleChunk`, more provider helpers
- [`@agentsy/agent`](./packages/agent.md) — `createAgentLoop`, `detectDoomLoop`, `finishReasonIs`, `hasNoToolCalls`, `isStepCount`
- [`@agentsy/adapters`](./packages/adapters.md) — `createGenericAdapter`, `processStream`, `processRawStream`, `runStructuredDecisionFromRawStream`, `applyDecisionAction`, provider adapter helpers
- [`@agentsy/renderers`](./packages/renderers.md) — `createPlainTextRenderer`, shared renderer types and utilities

## Parsing and shaping utilities

- [`@agentsy/thinking`](./packages/thinking.md) — `ThinkingParser`
- [`@agentsy/tool-calls`](./packages/tool-calls.md) — `extractXmlToolCalls`, `ToolCallAccumulator`, `buildNativeToolsPayload`, `buildToolResultMessage`, `buildXmlToolSystemPrompt`
- [`@agentsy/structured`](./packages/structured.md) — `parseJson`, `validateJsonSchema`, `buildFormatInstructions`, `buildRepairPrompt`, `streamJson`, `autoRepair`, `providerFormats`, `repairStateMachine`, `fieldValidator`, `zodAdapter`
- [`@agentsy/context`](./packages/context.md) — `splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`
- [`@agentsy/formatting`](./packages/formatting.md) — `appendToBlockquote`, `formatXmlLikeResponseForDisplay`, `sanitizeNonStreamingModelOutput`
- [`@agentsy/recovery`](./packages/recovery.md) — `captureStreamState`, `buildContinuationPrompt`
- [`@agentsy/xml-filter`](./packages/xml-filter.md) — `createXmlStreamFilter`, `tagLists`, `XmlStreamFilter`
- [`@agentsy/sse`](./packages/sse.md) — `SSEParser`, `parseSSEStream`
- [`@agentsy/types`](./packages/types.md) — shared conversation, stream, tool-call, and usage types

## State and integration surfaces

- [`@agentsy/ui`](./packages/ui.md) — `createConversationStore`, `createConversationStoreFromProcessor`, `bindProcessorToConversationStore`, `applyConversationEvent`
- [`@agentsy/ag-ui`](./packages/ag-ui.md) — `toAgUiStream`, `convertEventStream`, `createEventConverter`, `toCopilotKitEvent`, `toCustomUIEvent`, `StateManager`, `InterruptController`, `toObservable`
- [`@agentsy/vscode`](./packages/vscode.md) — `createVSCodeAgentLoop`, `createVSCodeChatRenderer`, `BaseLanguageModelChatProvider`, `ApiKeyManager`, settings, usage, and MCP helpers

## Private verification package

- [`@agentsy/integration`](./packages/integration.md) — repo-only integration verification coverage

## Related docs

- [Package catalog](./packages.md)
- [Architecture overview](./architecture/index.md)
- [Migrating from `@selfagency/llm-stream-parser`](./migration/llm-stream-parser.md)
