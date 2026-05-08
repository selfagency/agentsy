import type { LLMStreamProcessor, ProcessorOptions } from './processor/processor/index';
import type { XmlToolCall } from './tool-calls/index';
import type { UsageInfo } from '@agentsy/types';

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
    timestamp: Date.now(),
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
  options?: ContinuationOptions,
): ContinuationMessage[] {
  const provider = options?.provider ?? 'openai';

  const partialContent = snapshot.content.trim();

  // If nothing was accumulated, there is nothing to continue from.
  if (partialContent) {
    if (provider === 'anthropic') {
      // Anthropic supports prefilling: end the exchange with a partial assistant
      // message and the model continues from where it left off.
      return [{ role: 'assistant', content: partialContent }];
    }

    // OpenAI / Ollama: include the partial assistant turn then add a user message
    // asking the model to continue.
    return [
      { role: 'assistant', content: partialContent },
      { role: 'user', content: 'Please continue from exactly where you left off.' },
    ];
  }

  return [{ role: 'user', content: 'Please continue.' }];
}
