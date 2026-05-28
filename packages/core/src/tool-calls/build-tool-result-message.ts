import type { XmlToolCall } from './extract-xml-tool-calls.js';

/** Provider-agnostic tool result message. */
export interface ToolResultMessage {
  content: string;
  is_error?: boolean;
  name: string;
  role: 'tool';
  tool_call_id: string;
}

/** Anthropic-format tool result message (wrapped in a user turn). */
export interface AnthropicToolResult {
  content: [
    {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: true;
    }
  ];
  role: 'user';
}

/** OpenAI-format tool result message. */
export interface OpenAIToolResult {
  content: string;
  role: 'tool';
  tool_call_id: string;
}

/** Gemini-format tool result message (wrapped in a user turn). */
export interface GeminiToolResult {
  parts: [
    {
      functionResponse: {
        name: string;
        response: { output?: string; error?: string };
      };
    }
  ];
  role: 'user';
}

function normalizeContent(result: string | object): string {
  if (typeof result === 'string') {
    return result;
  }
  try {
    return JSON.stringify(result);
  } catch {
    // Handle circular references, BigInt, or other non-serializable values
    return typeof result === 'object'
      ? `[object ${(result?.constructor as { name?: string })?.name ?? 'Object'}]`
      : String(result);
  }
}

/**
 * Builds a provider-agnostic tool result message.
 *
 * @param toolCall - The tool call to respond to (must have an `id`).
 * @param result - The result content as a string or serialisable object.
 * @param options.isError - If `true`, signals that the result is an error payload.
 * @returns A `ToolResultMessage` with `role: "tool"` and optional error flag.
 */
export function buildToolResultMessage(
  toolCall: XmlToolCall,
  result: string | object,
  options?: { isError?: boolean }
): ToolResultMessage {
  const id = toolCall.id ?? toolCall.name;
  const message: ToolResultMessage = {
    content: normalizeContent(result),
    name: toolCall.name,
    role: 'tool',
    tool_call_id: id
  };
  if (options?.isError) {
    message.is_error = true;
  }
  return message;
}

/**
 * Builds an Anthropic-formatted tool result, wrapped inside a `user` turn.
 *
 * @param toolCall - The tool call to respond to.
 * @param result - The result content.
 * @param options.isError - Mark the result as an error block.
 */
export function buildAnthropicToolResult(
  toolCall: XmlToolCall,
  result: string | object,
  options?: { isError?: boolean }
): AnthropicToolResult {
  const id = toolCall.id ?? toolCall.name;
  const content = normalizeContent(result);
  const block: AnthropicToolResult['content'][0] = {
    content,
    tool_use_id: id,
    type: 'tool_result'
  };
  if (options?.isError) {
    block.is_error = true;
  }
  return { content: [block], role: 'user' };
}

/**
 * Builds an OpenAI-formatted tool result message.
 *
 * @param toolCall - The tool call to respond to.
 * @param result - The result content.
 */
export function buildOpenAIToolResult(toolCall: XmlToolCall, result: string | object): OpenAIToolResult {
  const id = toolCall.id ?? toolCall.name;
  return {
    content: normalizeContent(result),
    role: 'tool',
    tool_call_id: id
  };
}

/**
 * Builds a Gemini-formatted function response, wrapped inside a `user` turn.
 *
 * @param toolCall - The tool call to respond to.
 * @param result - The result content.
 * @param options.isError - If `true`, sets the result as an `error` field on the response object.
 */
export function buildGeminiToolResult(
  toolCall: XmlToolCall,
  result: string | object,
  options?: { isError?: boolean }
): GeminiToolResult {
  const content = normalizeContent(result);
  const response = options?.isError ? { error: content } : { output: content };
  return {
    parts: [
      {
        functionResponse: {
          name: toolCall.name,
          response
        }
      }
    ],
    role: 'user'
  };
}
