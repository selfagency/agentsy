import type { OutboundAdapterOptions, OutboundMessage, OutboundPart } from './types.js';

export const OPENAI_COMPATIBLE_PROVIDERS = ['openai', 'deepseek', 'kimi', 'qwen', 'llama', 'granite'] as const;

export type OpenAICompatibleProvider = (typeof OPENAI_COMPATIBLE_PROVIDERS)[number];

export function isOpenAICompatibleProvider(value: string): value is OpenAICompatibleProvider {
  return (OPENAI_COMPATIBLE_PROVIDERS as readonly string[]).includes(value);
}

export interface OpenAICompatibleToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type OpenAICompatibleMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAICompatibleToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

/**
 * Shared outbound mapper for OpenAI-compatible chat APIs.
 */
export function toOpenAICompatibleMessages(
  messages: readonly OutboundMessage[],
  _options: OutboundAdapterOptions = {},
): OpenAICompatibleMessage[] {
  return messages.map(msg => {
    const text = msg.parts
      .filter((p: OutboundPart): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('\n');

    const toolCallPart = msg.parts.find(p => p.type === 'tool-call');
    const toolResultPart = msg.parts.find(p => p.type === 'tool-result');

    if (toolResultPart && toolResultPart.type === 'tool-result') {
      return {
        role: 'tool',
        content: toolResultPart.content,
        tool_call_id: toolResultPart.callId,
      };
    }

    if (msg.role === 'system') return { role: 'system', content: text };
    if (msg.role === 'user') return { role: 'user', content: text };

    if (toolCallPart && toolCallPart.type === 'tool-call') {
      return {
        role: 'assistant',
        content: text || null,
        tool_calls: [
          {
            id: toolCallPart.callId,
            type: 'function',
            function: {
              name: toolCallPart.name,
              arguments: JSON.stringify(toolCallPart.input ?? {}),
            },
          },
        ],
      };
    }

    return { role: 'assistant', content: text };
  });
}

/**
 * Provider-aware alias that validates the provider belongs to the OpenAI-compatible set.
 */
export function toOpenAICompatibleProviderMessages(
  provider: OpenAICompatibleProvider,
  messages: readonly OutboundMessage[],
  options: OutboundAdapterOptions = {},
): OpenAICompatibleMessage[] {
  if (!isOpenAICompatibleProvider(provider)) {
    return [];
  }

  return toOpenAICompatibleMessages(messages, options);
}
