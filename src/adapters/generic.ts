import {
  LLMStreamProcessor,
  type ProcessedOutput,
  type ProcessorOptions,
  type StreamChunk,
} from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

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
  onDone?: () => void | Promise<void>;
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

  async function emit(output: ProcessedOutput): Promise<void> {
    if (output.thinking && showThinking && callbacks.onThinking) {
      await callbacks.onThinking(output.thinking);
    }

    if (output.content && callbacks.onContent) {
      await callbacks.onContent(output.content);
    }

    if (callbacks.onToolCall) {
      for (const toolCall of output.toolCalls) {
        await callbacks.onToolCall(toolCall);
      }
    }
  }

  return {
    async write(chunk: StreamChunk): Promise<void> {
      await emit(processor.process(chunk));
    },
    async end(): Promise<void> {
      await emit(processor.flush());
      if (callbacks.onDone) {
        await callbacks.onDone();
      }
    },
  };
}
