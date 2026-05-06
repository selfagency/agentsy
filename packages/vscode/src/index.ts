// Core types
export * from './types/index.js';

// API key management
export { ApiKeyManager } from './api-key-manager/api-key-manager.js';

// VS Code renderer (extracted from @agentsy/core)
export {
  accumulateToolCallDeltas,
  cancellationTokenToAbortSignal,
  createVSCodeAgentLoop,
  createVSCodeChatRenderer,
  ToolCallDeltaAccumulator,
  toVSCodeToolCallPart,
} from './vscode-renderer/index.js';
export type {
  ChatResponseStream,
  MinimalChatResponseStream,
  VSCodeAgentLoopOptions,
  VSCodeChatRendererOptions,
  VSCodeToolCallPartLike,
} from './vscode-renderer/index.js';

// Error handling
export {
  createProviderError,
  errorCodeToMessage,
  errorToProviderCode,
  httpStatusToErrorCode,
} from './error-handling/error-mapper.js';
export { calculateRetryDelay, isRetryableError, withRetry } from './error-handling/error-recovery.js';
export type { RetryOptions } from './error-handling/error-recovery.js';

// Message conversion
export { convertMessage, convertMessages, mapStreamChunkToVsCode } from './message-conversion/index.js';
export {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult,
} from './message-conversion/role-converter.js';
export type { ChatMessage, ChatToolCall } from './message-conversion/role-converter.js';

// Stream bridge (StreamChunk → VSCode)
export { bridgeStream, VSCodeStreamBridge } from './stream-bridge.js';
export type { VSCodeStreamBridgeOptions } from './stream-bridge.js';

// MCP chat bridge (MCPTransport → ChatResponseStream)
export { MCPChatBridge, createMCPChatBridge } from './stream-bridge/index.js';

// VS Code chat response stream overloads
export { createVSCodeChatResponseStream } from './vscode-overloads/index.js';
export type { VSCodeChatResponseStream } from './vscode-overloads/index.js';

// Retry utility with CancellationToken support
export { RetryUtility, createRetryUtility } from './retry/index.js';

// Base provider
export { BaseLanguageModelChatProvider } from './provider/index.js';
export type {
  CancellationToken,
  ExtensionContext,
  LanguageModelChatRequest,
  LanguageModelChatResponse,
  LanguageModelChatResponseChunk,
} from './provider/index.js';

// Settings
export { applyDefaults, SettingsLoader, validateSettings } from './settings/index.js';
export type { SchemaProperty, SettingsSchema } from './settings/index.js';

// Usage tracking
export {
  createQuotaDataSourceAdapter,
  formatQuotaText,
  formatStandardQuotaTooltip,
  getQuotaStatus,
  mapUsageToVSCode,
  pickActiveQuotaWindow,
  UsageStatusBar,
  type ActiveQuotaWindowStrategy,
  type QuotaAdapterOptions,
  type QuotaWindow,
  type QuotaWindowValue,
  type VSCodeUsage,
} from './usage-tracking/index.js';

// MCP integration (server definitions / registry)
export {
  createMcpServerDefinitionProvider,
  McpServerRegistry,
  type CreateMcpServerDefinitionProviderOptions,
  type McpProviderServerDefinition,
  type McpProviderSettingsReader,
} from './mcp-integration/index.js';

// MCP bridge helper (MCPTransport ↔ VS Code)
export { VSCodeMCPBridgeHelper, createVSCodeMCPBridge } from './mcp/index.js';

// Testing utilities
export {
  createChunkNormalizerStub,
  createMockApiKeyManager,
  createMockRendererHandle,
  type MockApiKeyManager,
  type MockRendererHandle,
} from './testing/index.js';
