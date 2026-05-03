// Core types
export * from './types/index.js';

// API key management
export { ApiKeyManager } from './api-key-manager/api-key-manager.js';

// VS Code renderer (extracted from @selfagency/llm-stream-parser)
export {
  cancellationTokenToAbortSignal,
  createVSCodeAgentLoop,
  createVSCodeChatRenderer,
} from './vscode-renderer/index.js';
export type {
  ChatResponseStream,
  VSCodeAgentLoopOptions,
  VSCodeChatRendererOptions,
} from './vscode-renderer/index.js';

// Error handling
export {
  httpStatusToErrorCode,
  errorToProviderCode,
  errorCodeToMessage,
  createProviderError,
} from './error-handling/error-mapper.js';
export {
  isRetryableError,
  calculateRetryDelay,
  withRetry,
} from './error-handling/error-recovery.js';
export type { RetryOptions } from './error-handling/error-recovery.js';

// Message conversion
export {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult,
} from './message-conversion/role-converter.js';
export { convertMessage, convertMessages } from './message-conversion/message-adapter.js';
export type { ChatMessage, ChatToolCall } from './message-conversion/role-converter.js';

// Base provider
export { BaseLanguageModelChatProvider } from './provider/index.js';
export type {
  LanguageModelChatRequest,
  CancellationToken,
  LanguageModelChatResponseChunk,
  LanguageModelChatResponse,
  ExtensionContext,
} from './provider/index.js';

// Settings
export { SettingsLoader } from './settings/index.js';
export { validateSettings, applyDefaults } from './settings/index.js';
export type { SettingsSchema, SchemaProperty } from './settings/index.js';

// Usage tracking
export { UsageStatusBar, formatQuotaText, getQuotaStatus } from './usage-tracking/index.js';

// MCP integration
export { McpServerRegistry } from './mcp-integration/index.js';
