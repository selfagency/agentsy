import type { BaseRendererOptions, TextOutput, RendererHandle, ThinkingStyle } from '../types.js';
import { LLMStreamProcessor } from '../../processor/LLMStreamProcessor.js';
import { appendToBlockquote } from '../../markdown/appendToBlockquote.js';
import type { StreamChunk } from '../../processor/LLMStreamProcessor.js';

/**
 * Options for the CLI markdown renderer.
 */
export interface CliRendererOptions extends BaseRendererOptions {
  /** Output target: writable stream or callback function. @default process.stdout */
  output?: TextOutput;

  /** How to render thinking blocks: 'blockquote' (default) or 'suppress'. @default 'blockquote' */
  thinkingStyle?: ThinkingStyle;
}

/**
 * Create a CLI markdown renderer that accumulates markdown content and renders
 * it to the terminal with ANSI colors and formatting via `cli-markdown`.
 *
 * Requires `cli-markdown` as a peer dependency. Tool calls are silently skipped.
 *
 * @param options - Configuration options
 * @returns A renderer handle with `write()` and `end()` methods
 *
 * @example
 * ```typescript
 * import { createCliRenderer } from '@selfagency/llm-stream-parser/renderers/cli';
 *
 * const renderer = createCliRenderer({
 *   showThinking: true,
 *   thinkingStyle: 'blockquote',
 *   output: process.stdout,
 * });
 *
 * await renderer.write('## Title\n\n');
 * await renderer.write('Some markdown content');
 * await renderer.end();
 * ```
 */
export function createCliRenderer(options: CliRendererOptions = {}): RendererHandle {
  const {
    output = process.stdout,
    showThinking = false,
    thinkingStyle = 'blockquote',
    processor,
    onError,
    onFinish,
  } = options;

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Guard flag to prevent double onFinish callback invocation
  let finished = false;

  // Accumulator for markdown content
  let accumulatedMarkdown = '';

  // Helper to write to output
  const writeOutput = (text: string): void => {
    if (typeof output === 'function') {
      output(text);
    } else if ('write' in output && typeof output.write === 'function') {
      output.write(text);
    }
  };

  // Lazily load cli-markdown with clear error message
  let cliMarkdown: ((markdown: string) => string) | null = null;
  const getCliMarkdown = async () => {
    if (!cliMarkdown) {
      try {
        // dynamic import to avoid hard peer dep
        // @ts-expect-error cli-markdown is a peer dependency
        const mod = await import('cli-markdown');
        cliMarkdown = mod.default as (markdown: string) => string;
      } catch {
        throw new Error(
          'CLI renderer requires "cli-markdown" peer dependency. Install it with: npm install cli-markdown',
        );
      }
    }
    return cliMarkdown;
  };

  return {
    async write(chunk: string): Promise<void> {
      try {
        // Process expects a StreamChunk, treat entire input as content
        const result = llmProcessor.process({ content: chunk });

        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              accumulatedMarkdown += part.text;
              break;
            }
            case 'thinking': {
              if (showThinking) {
                if (thinkingStyle === 'blockquote') {
                  accumulatedMarkdown += appendToBlockquote(part.text, true);
                  accumulatedMarkdown += '\n';
                }
                // 'suppress' style doesn't render thinking at all
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in CLI
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
              accumulatedMarkdown += part.text;
              break;
            }
            case 'thinking': {
              if (showThinking) {
                if (thinkingStyle === 'blockquote') {
                  accumulatedMarkdown += appendToBlockquote(part.text, true);
                  accumulatedMarkdown += '\n';
                }
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in CLI
              break;
            }
          }
        }

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
      let result: ReturnType<typeof llmProcessor.flush> | undefined;
      try {
        result = llmProcessor.flush();

        // Process any final parts
        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              accumulatedMarkdown += part.text;
              break;
            }
            case 'thinking': {
              if (showThinking) {
                if (thinkingStyle === 'blockquote') {
                  accumulatedMarkdown += appendToBlockquote(part.text, true);
                  accumulatedMarkdown += '\n';
                }
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in CLI
              break;
            }
          }
        }

        // Render accumulated markdown via cli-markdown (safe: only call on actual output streams)
        if (accumulatedMarkdown) {
          const md = await getCliMarkdown();
          // cli-markdown returns ANSI-formatted string
          const formatted = md(accumulatedMarkdown);
          writeOutput(formatted);
        }

        // Only call end() on actual streams, not on process.stdout
        if (
          typeof output === 'object' &&
          output !== process.stdout &&
          'end' in output &&
          typeof output.end === 'function'
        ) {
          output.end();
        }
      } catch (error) {
        if (onError && error instanceof Error) {
          onError(error);
        } else {
          throw error;
        }
      }

      // Fire onFinish callback to signal stream completion (if not already fired in writeChunk)
      if (!finished && result?.done && onFinish) {
        finished = true;
        await onFinish(result.finishReason, result.usage);
      }
    },
  };
}
