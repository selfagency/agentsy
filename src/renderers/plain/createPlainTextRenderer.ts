import type { BaseRendererOptions, TextOutput, RendererHandle } from '../types.js';
import { LLMStreamProcessor } from '../../processor/LLMStreamProcessor.js';
import type { StreamChunk } from '../../processor/LLMStreamProcessor.js';

/**
 * Options for the plain text renderer.
 */
export interface PlainTextRendererOptions extends BaseRendererOptions {
  /** Output target: writable stream or callback function. @default process.stdout */
  output?: TextOutput;

  /** Prefix for thinking blocks. @default '[Thinking] ' */
  thinkingPrefix?: string;
}

/**
 * Create a plain text renderer that accumulates text and thinking blocks,
 * writing to a writable stream or callback function.
 *
 * This is a zero-dependency renderer suitable for CLI tools, logging, and
 * server-side streaming. Tool calls are silently skipped (not rendered).
 *
 * @param options - Configuration options
 * @returns A renderer handle with `write()` and `end()` methods
 *
 * @example
 * ```typescript
 * import { createPlainTextRenderer } from '@selfagency/llm-stream-parser/renderers/plain';
 *
 * const renderer = createPlainTextRenderer({
 *   showThinking: true,
 *   thinkingPrefix: '💭 ',
 *   output: (text) => console.log(text),
 * });
 *
 * await renderer.write('Chunk 1');
 * await renderer.write('Chunk 2');
 * await renderer.end();
 * ```
 */
export function createPlainTextRenderer(options: PlainTextRendererOptions = {}): RendererHandle {
  const { output = process.stdout, showThinking = false, thinkingPrefix = '[Thinking] ', processor, onError, onFinish } = options;

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Helper to write to output
  const writeOutput = (text: string): void => {
    if (typeof output === 'function') {
      output(text);
    } else if ('write' in output && typeof output.write === 'function') {
      output.write(text);
    }
  };

  return {
    async write(chunk: string): Promise<void> {
      try {
        // Process expects a StreamChunk, but we're receiving raw text.
        // For the plain text renderer, we treat the entire input as content.
        const result = llmProcessor.process({ content: chunk });

        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              writeOutput(part.text);
              break;
            }
            case 'thinking': {
              if (showThinking) {
                writeOutput(thinkingPrefix + part.text + '\n');
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in plain text
              break;
            }
          }
        }
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

        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              writeOutput(part.text);
              break;
            }
            case 'thinking': {
              if (showThinking) {
                writeOutput(thinkingPrefix + part.text + '\n');
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in plain text
              break;
            }
          }
        }

        // Fire onFinish callback if stream is done
        if (chunk.done === true && onFinish) {
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

        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              writeOutput(part.text);
              break;
            }
            case 'thinking': {
              if (showThinking) {
                writeOutput(thinkingPrefix + part.text + '\n');
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in plain text
              break;
            }
          }
        }

        // Ensure output is flushed if it has an `end()` method
        if (typeof output === 'object' && 'end' in output && typeof output.end === 'function') {
          output.end();
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
