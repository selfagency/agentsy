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
  if (typeof p['value'] === 'string') return p['value'];
  if (typeof p['content'] === 'string') return p['content'];
  return '';
}

/**
 * Extracts tool call information from a VS Code LanguageModelToolCallPart.
 */
export function extractToolCall(part: unknown): ChatToolCall | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const p = part as Record<string, unknown>;

  const callId = p['callId'];
  const name = p['name'];
  const input = p['input'];

  if (typeof callId !== 'string' || typeof name !== 'string') return undefined;

  let args: Record<string, unknown> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    args = input as Record<string, unknown>;
  } else if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      args = {};
    }
  }

  return { id: callId, name, arguments: args };
}

/**
 * Extracts tool result information from a VS Code LanguageModelToolResultPart.
 */
export function extractToolResult(part: unknown): { callId: string; content: string } | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const p = part as Record<string, unknown>;

  const callId = p['callId'];
  if (typeof callId !== 'string') return undefined;

  let content = '';
  const innerContent = p['content'];
  if (Array.isArray(innerContent)) {
    content = innerContent.map(extractTextFromPart).join('');
  } else if (typeof innerContent === 'string') {
    content = innerContent;
  }

  return { callId, content };
}
