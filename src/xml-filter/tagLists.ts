export const ELEVATED_CONTEXT_TAG_NAMES = new Set([
  'environment_info',
  'user_info',
  'workspace_info',
  'selection',
  'file_context',
]);

export const SYSTEM_WRAPPER_TAG_NAMES = new Set([
  'user',
  'userRequest',
  'workspaces',
  'workspace',
  'session',
  'instructions',
  'context',
  'userPreferences',
  'userData',
  'profile',
  'history',
  'system',
  'systemPrompt',
  'chatHistory',
  'contextWindow',
  'injectedContext',
  'conversation-summary',
  'attachments',
  'attachment',
  'todoList',
  'toolCall',
  'tool_call',
  'reminderInstructions',
  'userMemory',
  'sessionMemory',
  'repository_memories',
]);

export const PRIVACY_TAG_NAMES = new Set([
  'user_info',
  'userPreferences',
  'userData',
  'userMemory',
  'sessionMemory',
  'repository_memories',
]);

export const DEFAULT_SCRUB_TAG_NAMES = new Set([
  ...ELEVATED_CONTEXT_TAG_NAMES,
  ...SYSTEM_WRAPPER_TAG_NAMES,
  ...PRIVACY_TAG_NAMES,
]);
