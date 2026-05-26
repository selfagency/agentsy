import type { CompletionMessage, NormalizedChunk, UsageInfo } from '@agentsy/types';

/**
 * Minimal streaming handler interface — avoids direct @agentsy/core/@agentsy/providers dependency.
 * Both `LoadBalancedClient` from @agentsy/gateway and the mock client satisfy this interface.
 */
export interface TurnHandler {
  stream(request: {
    messages: CompletionMessage[];
    model: string;
    stream?: boolean;
  }): Promise<ReadableStream<NormalizedChunk>>;
}

export interface TurnEventOptions {
  onDone?: (finishReason?: string, usage?: UsageInfo) => void;
  onError?: (error: Error) => void;
  onText?: (delta: string) => void;
  onThinking?: (delta: string) => void;
  onToolCall?: (id: string, name: string, args: unknown) => void;
}

export interface TurnResult {
  finishReason?: string;
  text: string;
  thinking: string;
  usage?: UsageInfo;
}

export interface SimpleTurnLoop {
  abort(): void;
  getMessages(): readonly CompletionMessage[];
  reset(): void;
  run(userInput: string, events?: TurnEventOptions): Promise<TurnResult>;
}

export interface SimpleTurnLoopOptions {
  handler: TurnHandler;
  model: string;
  systemPrompt?: string;
}

export function createSimpleTurnLoop(options: SimpleTurnLoopOptions): SimpleTurnLoop {
  const { handler, model, systemPrompt } = options;

  const messages: CompletionMessage[] = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];

  let activeReader: ReadableStreamDefaultReader<NormalizedChunk> | null = null;

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: refactor planned
  const run = async (userInput: string, events: TurnEventOptions = {}): Promise<TurnResult> => {
    const { onText, onThinking, onToolCall, onDone, onError } = events;

    messages.push({ role: 'user', content: userInput });

    let accText = '';
    let accThinking = '';
    let finishReason: string | undefined;
    let usage: UsageInfo | undefined;

    try {
      const stream = await handler.stream({ messages, model, stream: true });
      const reader = stream.getReader();
      activeReader = reader;

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }

        if (chunk.content) {
          accText += chunk.content;
          onText?.(chunk.content);
        }

        if (chunk.thinking) {
          accThinking += chunk.thinking;
          onThinking?.(chunk.thinking);
        }

        if (chunk.tool_calls) {
          for (const toolCall of chunk.tool_calls) {
            const name = toolCall.function?.name ?? '';
            const args = toolCall.function?.arguments ?? {};
            const id = (toolCall as { id?: string }).id ?? `tool-${Date.now()}`;
            if (name) {
              onToolCall?.(id, name, args);
            }
          }
        }

        if (chunk.usage) {
          usage = chunk.usage;
        }

        if (chunk.done) {
          finishReason = chunk.finishReason;
          break;
        }
      }

      activeReader = null;
    } catch (err) {
      activeReader = null;
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      // Remove the user message we pushed since the turn failed
      messages.pop();
      throw error;
    }

    // Append assistant response to history
    if (accText || accThinking) {
      messages.push({ role: 'assistant', content: accText });
    }

    const result: TurnResult = {
      text: accText,
      thinking: accThinking,
      ...(finishReason === undefined ? {} : { finishReason }),
      ...(usage === undefined ? {} : { usage })
    };
    onDone?.(finishReason, usage);
    return result;
  };

  const getMessages = (): readonly CompletionMessage[] => messages;

  const reset = (): void => {
    messages.length = 0;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
  };

  const abort = (): void => {
    if (activeReader) {
      activeReader.cancel();
      activeReader = null;
    }
  };

  return { run, getMessages, reset, abort };
}
