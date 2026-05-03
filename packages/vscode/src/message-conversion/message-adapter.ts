import {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult,
  type ChatMessage,
  type ChatToolCall,
} from './role-converter.js';

/**
 * Converts a VS Code LanguageModelChatMessage to the intermediate ChatMessage format.
 * Works with duck-typed objects to avoid importing vscode at test time.
 */
export function convertMessage(vsMessage: unknown): ChatMessage {
  if (!vsMessage || typeof vsMessage !== 'object') {
    return { role: 'user', content: '' };
  }

  const msg = vsMessage as Record<string, unknown>;
  const role = convertRole(typeof msg['role'] === 'number' ? msg['role'] : 1);
  const rawContent = msg['content'];
  const name = typeof msg['name'] === 'string' ? msg['name'] : undefined;

  if (typeof rawContent === 'string') {
    return { role, content: rawContent, ...(name ? { name } : {}) };
  }

  if (!Array.isArray(rawContent)) {
    return { role, content: '', ...(name ? { name } : {}) };
  }

  const textParts: string[] = [];
  const toolCalls: ChatToolCall[] = [];
  let toolCallId: string | undefined;

  for (const part of rawContent) {
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;

    // LanguageModelToolCallPart: has callId + name + input
    if ('callId' in p && 'name' in p && 'input' in p) {
      const tc = extractToolCall(p);
      if (tc) toolCalls.push(tc);
      continue;
    }

    // LanguageModelToolResultPart: has callId + content (array)
    if ('callId' in p && 'content' in p && !('name' in p)) {
      const tr = extractToolResult(p);
      if (tr) {
        toolCallId = tr.callId;
        textParts.push(tr.content);
        continue;
      }
    }

    // LanguageModelTextPart: has value
    const text = extractTextFromPart(p);
    if (text) textParts.push(text);
  }

  const content = textParts.join('');
  const result: ChatMessage = {
    role: toolCallId ? 'tool' : role,
    content,
    ...(name ? { name } : {}),
    ...(toolCallId ? { toolCallId } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };

  return result;
}

/**
 * Converts an array of VS Code LanguageModelChatMessages to ChatMessage array.
 */
export function convertMessages(vsMessages: unknown[]): ChatMessage[] {
  return vsMessages.map(convertMessage);
}

export type { ChatMessage, ChatToolCall };
