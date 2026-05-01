import type { BaseRendererOptions, TextOutput, RendererHandle } from '../types.js';
import { createSharedRendererHandle, createOutputWriter } from '../shared.js';

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
  const { output = process.stdout, showThinking = false, thinkingPrefix = '[Thinking] ' } = options;

  const writeOutput = createOutputWriter(output);

  return createSharedRendererHandle(
    options,
    {
      onText: async (text: string) => {
        writeOutput(text);
      },
      onThinking: async (text: string) => {
        if (showThinking) {
          writeOutput(thinkingPrefix + text + '\n');
        }
      },
      onEnd: async () => {
        // Call end() on stream if it has one
        if (typeof output === 'object' && 'end' in output && typeof output.end === 'function') {
          output.end();
        }
      },
    },
    options.onError,
  );
}
