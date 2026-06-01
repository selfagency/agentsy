/**
 * Intermediate chat message format used across providers.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  name?: string;
}

/**
 * Intermediate tool call format.
 */
export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Converts a VS Code LanguageModelChatMessageRole to a string role.
 * LanguageModelChatMessageRole.User = 1, Assistant = 2
 */
export function convertRole(role: number): ChatMessage['role'] {
  // vscode.LanguageModelChatMessageRole: User = 1, Assistant = 2
  // Use numeric comparison for test safety (no vscode import required)
  if (role === 2) return 'assistant';
  return 'user';
}

/**
 * Extracts text content from a VS Code content part.
 */
export function extractTextFromPart(part: unknown): string {
  if (!part || typeof part !== 'object') return '';
  const p = part as Record<string, unknown>;
  if (typeof p.value === 'string') return p.value;
  if (typeof p.content === 'string') return p.content;
  return '';
}

/**
 * Validates tool call part has required string fields.
 */
function isValidToolCallPart(p: Record<string, unknown>): boolean {
  return typeof p.callId === 'string' && typeof p.name === 'string';
}

/**
 * Extracts tool call information from a VS Code LanguageModelToolCallPart.
 */
export function extractToolCall(part: unknown): ChatToolCall | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const p = part as Record<string, unknown>;

  if (!isValidToolCallPart(p)) return undefined;

  const args = parseToolArguments(p.input);
  return { id: p.callId as string, name: p.name as string, arguments: args };
}

/**
 * Parse tool arguments from various input formats.
 */
function parseToolArguments(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to empty object
    }
  }
  return {};
}

/**
 * Extracts tool result information from a VS Code LanguageModelToolResultPart.
 */
export function extractToolResult(part: unknown): { callId: string; content: string } | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const p = part as Record<string, unknown>;

  const callId = p.callId;
  if (typeof callId !== 'string') return undefined;

  const content = extractContentFromPart(p.content);
  return { callId, content };
}

/**
 * Extract content from a content part (array or string).
 */
function extractContentFromPart(innerContent: unknown): string {
  if (Array.isArray(innerContent)) {
    return innerContent.map(extractTextFromPart).join('');
  }
  if (typeof innerContent === 'string') {
    return innerContent;
  }
  return '';
}
