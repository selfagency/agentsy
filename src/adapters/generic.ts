import {
  LLMStreamProcessor,
  type ProcessedOutput,
  type ProcessorOptions,
  type StreamChunk,
} from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

/**
 * Async generator that processes every chunk from a normalised LLM stream
 * and yields a `ProcessedOutput` for each chunk, finishing with a final flush output.
 *
 * @example
 * ```ts
 * for await (const output of processStream(normalizedStream)) {
 *   if (output.content) process.stdout.write(output.content);
 * }
 * ```
 */
export async function* processStream(
  source: AsyncIterable<StreamChunk>,
  options: ProcessorOptions = {},
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const chunk of source) {
    yield processor.process(chunk);
  }

  yield processor.flush();
}

export interface GenericAdapterCallbacks {
  /** Called with thinking/reasoning text (if enabled). */
  onThinking?: (text: string) => void | Promise<void>;
  /** Called with content text. */
  onContent?: (text: string) => void | Promise<void>;
  /** Called for each extracted tool call. */
  onToolCall?: (call: XmlToolCall) => void | Promise<void>;
  /** Called when the stream is complete. */
  onDone?: () => void | Promise<void> /** Called when any callback throws an error. */;
  onError?: (error: Error, context: { type: string; chunk?: StreamChunk }) => void | Promise<void>;
}

export interface GenericAdapterOptions extends ProcessorOptions {
  /** Whether to forward thinking text. Defaults to true. */
  showThinking?: boolean;
}

/**
 * Creates a callback-based adapter for processing LLM streams in any environment.
 * Similar to `createVSCodeCopilotAdapter` but environment-agnostic.
 *
 * @example
 * ```ts
 * const adapter = createGenericAdapter({
 *   onContent: (text) => process.stdout.write(text),
 *   onToolCall: (call) => handleTool(call),
 * });
 *
 * for await (const chunk of llmStream) {
 *   await adapter.write(chunk);
 * }
 * await adapter.end();
 * ```
 */
export function createGenericAdapter(
  callbacks: GenericAdapterCallbacks,
  options: GenericAdapterOptions = {},
): {
  write(chunk: StreamChunk): Promise<void>;
  end(): Promise<void>;
} {
  const processor = new LLMStreamProcessor(options);
  const showThinking = options.showThinking ?? true;

  async function emit(output: ProcessedOutput, chunk?: StreamChunk): Promise<void> {
    if (output.thinking && showThinking && callbacks.onThinking) {
      try {
        await callbacks.onThinking(output.thinking);
      } catch (error) {
        const err = error as Error;
        callbacks.onError?.(err, { type: 'thinking', ...(chunk !== undefined && { chunk }) });
      }
    }

    if (output.content && callbacks.onContent) {
      try {
        await callbacks.onContent(output.content);
      } catch (error) {
        const err = error as Error;
        callbacks.onError?.(err, { type: 'content', ...(chunk !== undefined && { chunk }) });
      }
    }

    if (callbacks.onToolCall) {
      for (const toolCall of output.toolCalls) {
        try {
          await callbacks.onToolCall(toolCall);
        } catch (error) {
          const err = error as Error;
          callbacks.onError?.(err, { type: 'tool_call', ...(chunk !== undefined && { chunk }) });
        }
      }
    }
  }

  return {
    async write(chunk: StreamChunk): Promise<void> {
      await emit(processor.process(chunk), chunk);
    },
    async end(): Promise<void> {
      await emit(processor.flush());
      if (callbacks.onDone) {
        try {
          await callbacks.onDone();
        } catch (error) {
          const err = error as Error;
          callbacks.onError?.(err, { type: 'done' });
        }
      }
    },
  };
}
