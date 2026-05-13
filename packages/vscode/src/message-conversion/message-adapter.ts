import {
  convertRole,
  extractTextFromPart,
  extractToolCall,
  extractToolResult,
  type ChatMessage,
  type ChatToolCall,
} from './role-converter.js';

/**
 * Processes a single content part and accumulates results.
 */
function processPart(
  part: unknown,
  textParts: string[],
  toolCalls: ChatToolCall[],
  state: { toolCallId?: string },
): void {
  if (!part || typeof part !== 'object') return;
  const p = part as Record<string, unknown>;

  // LanguageModelToolCallPart: has callId + name + input
  if ('callId' in p && 'name' in p && 'input' in p) {
    const tc = extractToolCall(p);
    if (tc) toolCalls.push(tc);
    return;
  }

  // LanguageModelToolResultPart: has callId + content (array)
  if ('callId' in p && 'content' in p && !('name' in p)) {
    const tr = extractToolResult(p);
    if (tr) {
      state.toolCallId = tr.callId;
      textParts.push(tr.content);
    }
    return;
  }

  // LanguageModelTextPart: has value
  const text = extractTextFromPart(p);
  if (text) textParts.push(text);
}

/**
 * Converts a VS Code LanguageModelChatMessage to the intermediate ChatMessage format.
 * Works with duck-typed objects to avoid importing vscode at test time.
 */
export function convertMessage(vsMessage: unknown): ChatMessage {
  if (!vsMessage || typeof vsMessage !== 'object') {
    return { role: 'user', content: '' };
  }

  const msg = vsMessage as Record<string, unknown>;
  const role = convertRole(typeof msg.role === 'number' ? msg.role : 1);
  const rawContent = msg.content;
  const name = typeof msg.name === 'string' ? msg.name : undefined;

  if (typeof rawContent === 'string') {
    return { role, content: rawContent, ...(name ? { name } : {}) };
  }

  if (!Array.isArray(rawContent)) {
    return { role, content: '', ...(name ? { name } : {}) };
  }

  const textParts: string[] = [];
  const toolCalls: ChatToolCall[] = [];
  const state: { toolCallId?: string } = {};

  for (const part of rawContent) {
    processPart(part, textParts, toolCalls, state);
  }

  const content = textParts.join('');
  const result: ChatMessage = {
    role: state.toolCallId ? 'tool' : role,
    content,
    ...(name ? { name } : {}),
    ...(state.toolCallId ? { toolCallId: state.toolCallId } : {}),
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

// fallow-ignore-next-line unused-type
export type { ChatMessage, ChatToolCall } from './role-converter.js';
