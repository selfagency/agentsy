import type { RendererHandle, BaseRendererOptions } from './types.js';
import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import type { StreamChunk, OutputPart } from '../processor/LLMStreamProcessor.js';

/**
 * Shared renderer handler builder to reduce duplication across renderers.
 * Handles common pattern: processor initialization, write/writeChunk dispatch to handlers.
 *
 * @internal
 */
export function createSharedRendererHandle(
  options: BaseRendererOptions,
  handlers: {
    onText: (text: string) => Promise<void>;
    onThinking: (text: string) => Promise<void>;
    onToolCall?: (part: OutputPart & { type: 'tool_call' }) => Promise<void>;
    onToolCallDelta?: (part: OutputPart & { type: 'tool_call_delta' }) => Promise<void>;
    onEnd?: () => Promise<void>;
  },
  onError?: (error: Error) => void,
): RendererHandle {
  const { processor, onFinish } = options;

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Guard flag to prevent double onFinish callback invocation
  let finished = false;

  /**
   * Process output parts through registered handlers.
   */
  async function processParts(parts: OutputPart[]): Promise<void> {
    for (const part of parts) {
      switch (part.type) {
        case 'text': {
          await handlers.onText(part.text);
          break;
        }
        case 'thinking': {
          await handlers.onThinking(part.text);
          break;
        }
        case 'tool_call': {
          if (handlers.onToolCall) {
            await handlers.onToolCall(part);
          }
          break;
        }
        case 'tool_call_delta': {
          if (handlers.onToolCallDelta) {
            await handlers.onToolCallDelta(part);
          }
          break;
        }
      }
    }
  }

  return {
    async write(chunk: string): Promise<void> {
      try {
        const result = llmProcessor.process({ content: chunk });
        await processParts(result.parts);
      } catch (error) {
        if (onError && error instanceof Error) {
          onError(error);
        } else {
          throw error;
        }
      }
    },

    async writeChunk(chunk: StreamChunk): Promise<void> {
      try {
        const result = llmProcessor.process(chunk);
        await processParts(result.parts);

        // Fire onFinish callback if stream is done (guard against double invocation)
        if (chunk.done === true && !finished && onFinish) {
          finished = true;
          await onFinish(chunk.finishReason, chunk.usage);
        }
      } catch (error) {
        if (onError && error instanceof Error) {
          onError(error);
        } else {
          throw error;
        }
      }
    },

    async end(): Promise<void> {
      try {
        const result = llmProcessor.flush();
        await processParts(result.parts);

        // Fire onFinish if not already fired in writeChunk
        if (!finished && onFinish) {
          finished = true;
          await onFinish(result.finishReason, result.usage);
        }

        // Call stream-specific end handler if provided
        if (handlers.onEnd) {
          await handlers.onEnd();
        }
      } catch (error) {
        if (onError && error instanceof Error) {
          onError(error);
        } else {
          throw error;
        }
      }
    },
  };
}

/**
 * Shared output writer that handles both function and stream interfaces.
 * @internal
 */
export function createOutputWriter(
  output: NodeJS.WritableStream | ((text: string) => void) | { write: (text: string) => void },
): (text: string) => void {
  return (text: string): void => {
    if (typeof output === 'function') {
      output(text);
    } else if ('write' in output && typeof output.write === 'function') {
      output.write(text);
    }
  };
}
