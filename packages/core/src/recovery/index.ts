import type { UsageInfo } from '@agentsy/types';
import type { LLMStreamProcessor, ProcessorOptions } from '../processor/index.js';
import type { XmlToolCall } from '../tool-calls/index.js';

export interface StreamSnapshot {
  /** Accumulated assistant content at the time the snapshot was taken. */
  content: string;
  /** Accumulated thinking/scratchpad content. */
  thinking: string;
  /** Tool calls that were completed up to this point. */
  toolCalls: XmlToolCall[];
  /** Accumulated token usage, if available. */
  usage?: UsageInfo;
  /** The `ProcessorOptions` the processor was constructed with (for rebuilding). */
  options: ProcessorOptions;
  /** Unix timestamp (ms) when the snapshot was taken. */
  timestamp: number;
}

export interface ContinuationOptions {
  /**
   * The target provider. Controls how the continuation prompt is formatted.
   * - `'anthropic'`: Prepend the partial assistant turn as an assistant message.
   * - `'openai'`: Append the partial assistant message then add a user continuation message.
   * - `'ollama'`: Same format as OpenAI.
   * Defaults to `'openai'`.
   */
  provider?: 'openai' | 'anthropic' | 'ollama';
}

/** A generic message object compatible with OpenAI / Anthropic / Ollama chat APIs. */
export interface ContinuationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function formatToolCallParameters(parameters: XmlToolCall['parameters']): string {
  try {
    return JSON.stringify(parameters);
  } catch {
    return '{}';
  }
}

function buildCompletedToolCallsContext(toolCalls: readonly XmlToolCall[]): string | null {
  if (toolCalls.length > 0) {
    const serializedCalls = toolCalls.map(toolCall => {
      return `- ${toolCall.name}(${formatToolCallParameters(toolCall.parameters)})`;
    });

    return ['The following tool calls already completed before the interruption:', ...serializedCalls].join('\n');
  }

  return null;
}

/**
 * Capture the current accumulated state of a `LLMStreamProcessor` for later
 * stream resumption or retry.
 */
export function captureStreamState(processor: LLMStreamProcessor, options?: ProcessorOptions): StreamSnapshot {
  const msg = processor.accumulatedMessage;
  return {
    content: msg.content,
    thinking: msg.thinking,
    toolCalls: msg.toolCalls,
    ...(msg.usage != null ? { usage: msg.usage } : {}),
    options: options ?? {},
    timestamp: Date.now()
  };
}

/**
 * Build a provider-appropriate set of messages that allows resuming a stream
 * that was interrupted mid-response.
 *
 * The returned messages should be appended to (or replace the last assistant
 * message in) the conversation history before sending the next request.
 */
export function buildContinuationPrompt(
  snapshot: StreamSnapshot,
  options?: ContinuationOptions
): ContinuationMessage[] {
  const provider = options?.provider ?? 'openai';

  const partialContent = snapshot.content.trim();
  const completedToolCallsContext = buildCompletedToolCallsContext(snapshot.toolCalls);

  if (partialContent.length > 0) {
    if (provider === 'anthropic') {
      if (completedToolCallsContext !== null) {
        return [
          {
            role: 'user',
            content: `${completedToolCallsContext}\n\nContinue from exactly where you left off without repeating the completed tool calls.`
          },
          { role: 'assistant', content: partialContent }
        ];
      }

      return [{ role: 'assistant', content: partialContent }];
    }

    const userContent = completedToolCallsContext
      ? `${completedToolCallsContext}\n\nPlease continue from exactly where you left off without repeating the completed tool calls.`
      : 'Please continue from exactly where you left off.';

    return [
      { role: 'assistant', content: partialContent },
      { role: 'user', content: userContent }
    ];
  }

  const userContent = completedToolCallsContext
    ? `${completedToolCallsContext}\n\nPlease continue without repeating the completed tool calls.`
    : 'Please continue.';

  return [{ role: 'user', content: userContent }];
}
