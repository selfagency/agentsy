import type { BaseRendererOptions, RendererHandle } from '../types.js';
import { LLMStreamProcessor } from '../../processor/LLMStreamProcessor.js';
import type { StreamChunk } from '../../processor/LLMStreamProcessor.js';

/**
 * Options for the browser streaming markdown renderer.
 */
export interface StreamingMarkdownRendererOptions extends BaseRendererOptions {
  /** Target HTML element where markdown will be rendered. Required. */
  target: any; // HTMLElement in browser, but we use any for Node.js type compatibility

  /** Optional container for thinking blocks. If not provided, thinking is rendered inline. */
  thinkingContainer?: any | null; // HTMLElement | null in browser

  /** Callback fired if a security violation is detected during sanitization. */
  onSecurityViolation?: () => void;
}

/**
 * Create a browser streaming markdown renderer that appends markdown content
 * to a target DOM element with append-only updates, security sanitization,
 * and proper thinking block handling.
 *
 * Requires `streaming-markdown` and `dompurify` as peer dependencies.
 * This renderer is ESM-only; CJS environments will throw an error.
 *
 * @param options - Configuration options (target element required)
 * @returns A renderer handle with `write()` and `end()` methods
 *
 * @example
 * ```typescript
 * import { createStreamingMarkdownRenderer } from '@selfagency/llm-stream-parser/renderers/streaming-md';
 *
 * const target = document.getElementById('content');
 * const renderer = createStreamingMarkdownRenderer({
 *   target,
 *   showThinking: true,
 *   onSecurityViolation: () => console.warn('XSS attempt blocked'),
 * });
 *
 * await renderer.write('# Title\n\n');
 * await renderer.write('Markdown content');
 * await renderer.end();
 * ```
 */
export function createStreamingMarkdownRenderer(options: StreamingMarkdownRendererOptions): RendererHandle {
  const { target, showThinking = false, thinkingContainer = null, onSecurityViolation, processor, onError } = options;

  if (!target) {
    throw new Error('Target element is required for streaming markdown renderer');
  }

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Accumulator for markdown content
  let accumulatedMarkdown = '';
  let parser: any = null;

  // Lazily load streaming-markdown and dompurify with clear error messages
  const getStreamingMarkdownDeps = async () => {
    try {
      // @ts-expect-error streaming-markdown is a peer dependency
      const smd = await import('streaming-markdown');
      // @ts-expect-error dompurify is a peer dependency
      const DOMPurify = await import('dompurify');

      return { smd, DOMPurify };
    } catch {
      throw new Error(
        'Streaming markdown renderer requires "streaming-markdown" and "dompurify" peer dependencies. Install with: npm install streaming-markdown dompurify',
      );
    }
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
                if (thinkingContainer) {
                  // Render thinking in separate container
                  accumulatedMarkdown += `\n> **💭 Thinking:** ${part.text}\n`;
                } else {
                  // Render thinking inline as blockquote
                  accumulatedMarkdown += `\n> **💭 Thinking:** ${part.text}\n`;
                }
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered in browser streaming
              break;
            }
          }
        }

        // Incremental streaming: render accumulated markdown so far
        if (accumulatedMarkdown && parser) {
          const { smd, DOMPurify } = await getStreamingMarkdownDeps();

          // Security check: sanitize accumulated markdown
          const sanitized = DOMPurify.default
            ? DOMPurify.default.sanitize(accumulatedMarkdown)
            : DOMPurify.sanitize(accumulatedMarkdown);

          if (DOMPurify.default && DOMPurify.default.removed && DOMPurify.default.removed.length > 0) {
            // Security violation detected
            if (parser && smd.default.parser_end) {
              smd.default.parser_end(parser);
            }
            if (onSecurityViolation) {
              onSecurityViolation();
            }
            return;
          } else if (DOMPurify.removed && DOMPurify.removed.length > 0) {
            // Security violation detected
            if (parser && smd.default.parser_end) {
              smd.default.parser_end(parser);
            }
            if (onSecurityViolation) {
              onSecurityViolation();
            }
            return;
          }

          // Append new content to DOM
          try {
            if (smd.default && smd.default.parser_write) {
              smd.default.parser_write(parser, chunk);
            }
          } catch (e) {
            // Continue even if streaming fails
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

    async end(): Promise<void> {
      try {
        const result = llmProcessor.flush();

        // Process any final parts
        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              accumulatedMarkdown += part.text;
              break;
            }
            case 'thinking': {
              if (showThinking) {
                accumulatedMarkdown += `\n> **💭 Thinking:** ${part.text}\n`;
              }
              break;
            }
            case 'tool_call': {
              // Tool calls not rendered
              break;
            }
          }
        }

        // Finalize streaming: render any remaining markdown
        if (accumulatedMarkdown) {
          const { smd, DOMPurify } = await getStreamingMarkdownDeps();

          // Create parser if not already created
          if (!parser && smd.default && smd.default.parser_create) {
            parser = smd.default.parser_create({ target });
          }

          if (parser && smd.default && smd.default.parser_end) {
            smd.default.parser_end(parser);
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
  };
}
