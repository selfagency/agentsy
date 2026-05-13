# API index

This page is a link-first map of the currently available APIs.

Detailed API breakdowns, examples, and composition guidance live on the individual package pages under `docs/packages/`. This page helps you find the right package quickly instead of forcing every export detail into one long reference blob.

## Status notes

- **Published** means the package is live on npm now.
- **Private** means the package is repo-internal.
- Future agentic tooling described in `plan/` remains roadmap material until package code exists.

## Runtime and orchestration

- [`@agentsy/core/processor`](./packages/processor.md) — `LLMStreamProcessor`, `createProcessorEventAdapter`, `ToolCallParser`, `ZAiInlineToolCallParser`, `createSmoothStream`, `createThinkingFilter`, `createToolCallFilter`
- [`@agentsy/providers`](./packages/providers.md) — provider package root for adapters, normalizers, pipeline helpers, and universal-client abstractions
- [`@agentsy/providers/normalizers`](./packages/normalizers.md) — `normalizeOpenAIChatChunk`, `normalizeOpenAIResponseEvent`, `normalizeAnthropicEvent`, `normalizeGeminiChunk`, `normalizeMistralChunk`, `normalizeOllamaChatChunk`, `normalizeOpenAICompatibleChunk`, more provider helpers
- [`@agentsy/providers/pipeline`](./packages/providers.md) — `createPipeline`, `PipelineEvent`, `NormalizerProvider`
- [`@agentsy/orchestrator/agent`](./packages/agent.md) — `createAgentLoop`, `detectDoomLoop`, `finishReasonIs`, `hasNoToolCalls`, `isStepCount`
- [`@agentsy/providers/adapters`](./packages/adapters.md) — `createGenericAdapter`, `processStream`, `processRawStream`, `runStructuredDecisionFromRawStream`, `applyDecisionAction`, provider adapter helpers
- [`@agentsy/renderers`](./packages/renderers.md) — `createPlainTextRenderer`, shared renderer types and utilities

## Parsing and shaping utilities

- [`@agentsy/core/thinking`](./packages/thinking.md) — `ThinkingParser`
- [`@agentsy/core/tool-calls`](./packages/tool-calls.md) — `extractXmlToolCalls`, `ToolCallAccumulator`, `buildNativeToolsPayload`, `buildToolResultMessage`, `buildXmlToolSystemPrompt`
- [`@agentsy/core/structured`](./packages/structured.md) — `parseJson`, `validateJsonSchema`, `buildFormatInstructions`, `buildRepairPrompt`, `streamJson`, `autoRepair`, `providerFormats`, `repairStateMachine`, `fieldValidator`, `zodAdapter`
- [`@agentsy/core/context`](./packages/context.md) — `splitLeadingXmlContextBlocks`, `dedupeXmlContextBlocksByTag`, `stripXmlContextTags`
- [`@agentsy/core/formatting`](./packages/formatting.md) — `appendToBlockquote`, `formatXmlLikeResponseForDisplay`, `sanitizeNonStreamingModelOutput`
- [`@agentsy/core/recovery`](./packages/recovery.md) — `captureStreamState`, `buildContinuationPrompt`
- [`@agentsy/core/xml-filter`](./packages/xml-filter.md) — `createXmlStreamFilter`, `tagLists`, `XmlStreamFilter`
- [`@agentsy/core/sse`](./packages/sse.md) — `SSEParser`, `parseSSEStream`
- [`@agentsy/types`](./packages/types.md) — shared conversation, stream, tool-call, and usage types
- [`@agentsy/tokens`](./packages/tokens.md) — `createTokenLedger`, `createInMemoryTokenManager`, `compressConversation`, `PacingController`

## State and integration surfaces

- [`@agentsy/ui`](./packages/ui.md) — `createConversationStore`, `createConversationStoreFromProcessor`, `bindProcessorToConversationStore`, `applyConversationEvent`
- [`@agentsy/runtime/ag-ui`](./packages/ag-ui.md) — `toAgUiStream`, `convertEventStream`, `createEventConverter`, `toCopilotKitEvent`, `toCustomUIEvent`, `StateManager`, `InterruptController`, `toObservable`
- [`@agentsy/vscode`](./packages/vscode.md) — `createVSCodeAgentLoop`, `createVSCodeChatRenderer`, `BaseLanguageModelChatProvider`, `ApiKeyManager`, settings, usage, and MCP helpers

## Private verification package

- [`@agentsy/testing`](./packages/testing.md) — repo-only cross-package integration verification coverage

## Related docs

- [Package catalog](./packages.md)
- [Architecture overview](./architecture/index.md)
- [Migrating from `@selfagency/llm-stream-parser`](/migration/llm-stream-parser)
