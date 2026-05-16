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
  toVSCodeToolCallPart
} from './vscode-renderer/index.js';
export type {
  ChatResponseStream,
  MinimalChatResponseStream,
  VSCodeAgentLoopOptions,
  VSCodeChatRendererOptions,
  VSCodeToolCallPartLike
} from './vscode-renderer/index.js';

// Error handling
export {
  createProviderError,
  errorCodeToMessage,
  errorToProviderCode,
  httpStatusToErrorCode
} from './error-handling/error-mapper.js';
export { calculateRetryDelay, isRetryableError, withRetry } from './error-handling/error-recovery.js';
export type { RetryOptions } from './error-handling/error-recovery.js';

// Message conversion
export { convertMessage, convertMessages, mapStreamChunkToVsCode } from './message-conversion/index.js';
export {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult
} from './message-conversion/role-converter.js';
export type { ChatMessage, ChatToolCall } from './message-conversion/role-converter.js';

// Stream bridge
export { bridgeStream, VSCodeStreamBridge } from './stream-bridge.js';
export type { VSCodeStreamBridgeOptions } from './stream-bridge.js';

// Retry utility
export { createRetryUtility, RetryUtility } from './retry/index.js';

// VS Code overload helpers
export { createVSCodeChatResponseStream } from './vscode-overloads/index.js';
export type { VSCodeChatResponseStream } from './vscode-overloads/index.js';

// MCP stream bridge
export { createVSCodeMCPBridge, VSCodeMCPBridgeHelper } from './mcp/vscodeBridgeHelper.js';
export { createMCPChatBridge, MCPChatBridge } from './stream-bridge/mcpChatBridge.js';

// Base provider
export { BaseLanguageModelChatProvider } from './provider/index.js';
export type {
  CancellationToken,
  ExtensionContext,
  LanguageModelChatRequest,
  LanguageModelChatResponse,
  LanguageModelChatResponseChunk
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
  type VSCodeUsage
} from './usage-tracking/index.js';

// MCP integration
export {
  createMcpServerDefinitionProvider,
  McpServerRegistry,
  type CreateMcpServerDefinitionProviderOptions,
  type McpProviderServerDefinition,
  type McpProviderSettingsReader
} from './mcp-integration/index.js';

// Testing utilities
export {
  createChunkNormalizerStub,
  createMockApiKeyManager,
  createMockRendererHandle,
  type MockApiKeyManager,
  type MockRendererHandle
} from './testing/index.js';
