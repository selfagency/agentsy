import { appendToBlockquote } from '@agentsy/core/formatting';
import type { StreamChunk } from '@agentsy/core/processor';
import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createStepChangeEmitter } from '../shared.js';
import type { BaseRendererOptions, RendererHandle, TextOutput, ThinkingStyle } from '../types.js';

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
    onFinish
  } = options;

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Guard flag to prevent double onFinish callback invocation
  let finished = false;
  const emitStepChange = createStepChangeEmitter(options.onStep);
  // Track if output is a user-supplied stream (vs default process.stdout)
  const isUserSuppliedStream = output !== process.stdout && output !== process.stderr;

  // Accumulator for markdown content
  let accumulatedMarkdown = '';

  // Helper to write to output
  function writeOutput(text: string): void {
    if (typeof output === 'function') {
      output(text);
    } else if ('write' in output && typeof output.write === 'function') {
      output.write(text);
    }
  }

  // Lazily load cli-markdown with clear error message
  let cliMarkdown: ((markdown: string) => string) | null = null;
  async function getCliMarkdown(): Promise<(markdown: string) => string> {
    if (!cliMarkdown) {
      try {
        // dynamic import to avoid hard peer dep
        const mod = await import('cli-markdown');
        cliMarkdown = mod.default as (markdown: string) => string;
      } catch {
        throw new Error(
          'CLI renderer requires "cli-markdown" peer dependency. Install it with: npm install cli-markdown'
        );
      }
    }
    return cliMarkdown;
  }

  /**
   * Process parts from output, accumulating markdown content.
   * @internal
   */
  function processParts(parts: Array<{ type: string; text?: string }>): void {
    for (const part of parts) {
      if (part.type === 'text' && part.text) {
        accumulatedMarkdown += part.text;
      } else if (part.type === 'thinking' && showThinking && part.text) {
        if (thinkingStyle === 'blockquote') {
          accumulatedMarkdown += appendToBlockquote(part.text, true);
          accumulatedMarkdown += '\n';
        }
      }
    }
  }

  return {
    async write(chunk: string): Promise<void> {
      try {
        const result = llmProcessor.process({ content: chunk });
        processParts(result.parts);
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
        processParts(result.parts);
        await emitStepChange(result);

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
        processParts(result.parts);
        await emitStepChange(result);

        // Render accumulated markdown via cli-markdown
        if (accumulatedMarkdown) {
          const md = await getCliMarkdown();
          const formatted = md(accumulatedMarkdown);
          writeOutput(formatted);
        }

        // Only call end() on user-supplied streams, not on process.stdout/stderr
        if (isUserSuppliedStream && typeof output === 'object' && 'end' in output && typeof output.end === 'function') {
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
    }
  };
}
