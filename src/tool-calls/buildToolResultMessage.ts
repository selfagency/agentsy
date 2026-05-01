import type { XmlToolCall } from './extractXmlToolCalls.js';

/** Provider-agnostic tool result message. */
export interface ToolResultMessage {
  role: 'tool';
  tool_call_id: string;
  name: string;
  content: string;
}

/** Anthropic-format tool result message (wrapped in a user turn). */
export interface AnthropicToolResult {
  role: 'user';
  content: [
    {
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: true;
    },
  ];
}

/** OpenAI-format tool result message. */
export interface OpenAIToolResult {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

/** Gemini-format tool result message (wrapped in a user turn). */
export interface GeminiToolResult {
  role: 'user';
  parts: [
    {
      functionResponse: {
        name: string;
        response: { output?: string; error?: string };
      };
    },
  ];
}

function normalizeContent(result: string | object): string {
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

/**
 * Builds a provider-agnostic tool result message.
 *
 * @param toolCall - The tool call to respond to (must have an `id`).
 * @param result - The result content as a string or serialisable object.
 * @param options.isError - If `true`, signals that the result is an error payload.
 * @returns A `ToolResultMessage` with `role: "tool"`.
 */
export function buildToolResultMessage(
  toolCall: XmlToolCall,
  result: string | object,
  options?: { isError?: boolean },
): ToolResultMessage {
  const id = toolCall.id ?? toolCall.name;
  return {
    role: 'tool',
    tool_call_id: id,
    name: toolCall.name,
    content: normalizeContent(result),
  };
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
  options?: { isError?: boolean },
): AnthropicToolResult {
  const id = toolCall.id ?? toolCall.name;
  const content = normalizeContent(result);
  const block: AnthropicToolResult['content'][0] = {
    type: 'tool_result',
    tool_use_id: id,
    content,
  };
  if (options?.isError) {
    block.is_error = true;
  }
  return { role: 'user', content: [block] };
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
    role: 'tool',
    tool_call_id: id,
    content: normalizeContent(result),
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
  options?: { isError?: boolean },
): GeminiToolResult {
  const content = normalizeContent(result);
  const response = options?.isError ? { error: content } : { output: content };
  return {
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: toolCall.name,
          response,
        },
      },
    ],
  };
}
