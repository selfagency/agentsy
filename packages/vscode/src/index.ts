// Core types

// API key management
export { ApiKeyManager } from './api-key-manager/api-key-manager.js';
// Error handling
export {
  createProviderError,
  errorCodeToMessage,
  errorToProviderCode,
  httpStatusToErrorCode
} from './error-handling/error-mapper.js';
export type { RetryOptions } from './error-handling/error-recovery.js';
export {
  calculateRetryDelay,
  isRetryableError,
  withRetry
} from './error-handling/error-recovery.js';
// MCP stream bridge
export { createVSCodeMCPBridge, VSCodeMCPBridgeHelper } from './mcp/vscode-bridge-helper.js';
// MCP integration
export {
  type CreateMcpServerDefinitionProviderOptions,
  createMcpServerDefinitionProvider,
  type McpProviderServerDefinition,
  type McpProviderSettingsReader,
  McpServerRegistry
} from './mcp-integration/index.js';
// Message conversion
export {
  convertMessage,
  convertMessages,
  mapStreamChunkToVsCode
} from './message-conversion/index.js';
export type { ChatMessage, ChatToolCall } from './message-conversion/role-converter.js';
export {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult
} from './message-conversion/role-converter.js';
export type {
  CancellationToken,
  ExtensionContext,
  LanguageModelChatRequest,
  LanguageModelChatResponse,
  LanguageModelChatResponseChunk
} from './provider/index.js';
// Base provider
export { BaseLanguageModelChatProvider } from './provider/index.js';
// Retry utility
export { createRetryUtility, RetryUtility } from './retry/index.js';
export type { SchemaProperty, SettingsSchema } from './settings/index.js';
// Settings
export {
  applyDefaults,
  getVSCodeSetupGuide,
  runVSCodeSettingsDiagnostics,
  SettingsLoader,
  validateSettings
} from './settings/index.js';
export { createMCPChatBridge, MCPChatBridge } from './stream-bridge/mcp-chat-bridge.js';
export type { VSCodeStreamBridgeOptions } from './stream-bridge.js';
// Stream bridge
export { bridgeStream, VSCodeStreamBridge } from './stream-bridge.js';
// Testing utilities
export {
  createChunkNormalizerStub,
  createMockApiKeyManager,
  createMockRendererHandle,
  type MockApiKeyManager,
  type MockRendererHandle
} from './testing/index.js';
export * from './types/index.js';
// Usage tracking
export {
  type ActiveQuotaWindowStrategy,
  createQuotaDataSourceAdapter,
  formatQuotaText,
  formatStandardQuotaTooltip,
  getQuotaStatus,
  mapUsageToVSCode,
  pickActiveQuotaWindow,
  type QuotaAdapterOptions,
  type QuotaWindow,
  type QuotaWindowValue,
  UsageStatusBar,
  type VSCodeUsage
} from './usage-tracking/index.js';
export type { VSCodeChatResponseStream } from './vscode-overloads/index.js';
// VS Code overload helpers
export { createVSCodeChatResponseStream } from './vscode-overloads/index.js';
export type {
  ChatResponseStream,
  MinimalChatResponseStream,
  VSCodeAgentLoopOptions,
  VSCodeChatRendererOptions,
  VSCodeToolCallPartLike
} from './vscode-renderer/index.js';
// VS Code renderer (extracted from @agentsy/core)
export {
  accumulateToolCallDeltas,
  cancellationTokenToAbortSignal,
  createVSCodeAgentLoop,
  createVSCodeChatRenderer,
  ToolCallDeltaAccumulator,
  toVSCodeToolCallPart
} from './vscode-renderer/index.js';
