import type { BaseRendererOptions, RendererHandle } from '../types.js';
import { LLMStreamProcessor } from '../../processor/LLMStreamProcessor.js';
import type { StreamChunk } from '../../processor/LLMStreamProcessor.js';

/**
 * Duck-typed interface matching VS Code's ChatResponseStream.
 * Allows renderer to work with actual VS Code ChatResponseStream without hard dependency.
 */
export interface ChatResponseStream {
  text(content: string): void;
  progress(content: string): void;
  markdown(content: string): void;
  anchor(element: any, title?: string): void;
  reference(element: any, iconPath?: any, title?: string): void;
  button(options: any): void;
  filetree(roots: any[], options?: any): void;
}

/**
 * Options for the VS Code chat renderer.
 */
export interface VSCodeChatRendererOptions extends BaseRendererOptions {
  /** VS Code ChatResponseStream instance. Required. */
  stream: ChatResponseStream;

  /** How to render thinking blocks: 'blockquote' or 'progress'. Default: 'blockquote'. */
  thinkingStyle?: 'blockquote' | 'progress';
}

/**
 * Create a VS Code extension chat renderer that streams markdown content
 * to a ChatResponseStream with support for thinking blocks and tool call callbacks.
 *
 * This renderer integrates with VS Code's chat interface, sending markdown
 * content incrementally as it arrives from the LLM. Thinking blocks can be
 * rendered as either blockquotes or progress indicators.
 *
 * @param options - Configuration options (stream required)
 * @returns A renderer handle with `write()` and `end()` methods
 *
 * @example
 * ```typescript
 * import { createVSCodeChatRenderer } from '@selfagency/llm-stream-parser/renderers/vscode';
 *
 * const renderer = createVSCodeChatRenderer({
 *   stream, // ChatResponseStream from VS Code
 *   showThinking: true,
 *   thinkingStyle: 'progress',
 * });
 *
 * await renderer.write('# Response\n\n');
 * await renderer.write('Some content here');
 * await renderer.end();
 * ```
 */
export function createVSCodeChatRenderer(options: VSCodeChatRendererOptions): RendererHandle {
  const { stream, showThinking = false, thinkingStyle = 'blockquote', processor, onError, onToolCall } = options;

  if (!stream) {
    throw new Error('ChatResponseStream is required for VS Code chat renderer');
  }

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Accumulator for markdown content
  let accumulatedMarkdown = '';
  let accumulatedThinking = '';

  return {
    async write(chunk: string): Promise<void> {
      try {
        // Process expects a StreamChunk, treat entire input as content
        const result = llmProcessor.process({ content: chunk });

        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              accumulatedMarkdown += part.text;
              // Stream text incrementally for responsive UI
              stream.markdown(part.text);
              break;
            }
            case 'thinking': {
              if (showThinking) {
                accumulatedThinking += part.text;

                if (thinkingStyle === 'progress') {
                  // Show thinking as a progress indicator
                  stream.progress(part.text);
                } else {
                  // Show thinking as blockquote (blockquote style)
                  const blockquoteThinking = `> **💭 Thinking:** ${part.text}`;
                  stream.markdown(blockquoteThinking);
                }
              }
              break;
            }
            case 'tool_call': {
              // Emit tool call callback but don't render
              if (onToolCall) {
                onToolCall(part);
              }
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

    async end(): Promise<void> {
      try {
        const result = llmProcessor.flush();

        // Process any final parts
        for (const part of result.parts) {
          switch (part.type) {
            case 'text': {
              accumulatedMarkdown += part.text;
              stream.markdown(part.text);
              break;
            }
            case 'thinking': {
              if (showThinking) {
                accumulatedThinking += part.text;

                if (thinkingStyle === 'progress') {
                  stream.progress(part.text);
                } else {
                  const blockquoteThinking = `> **💭 Thinking:** ${part.text}`;
                  stream.markdown(blockquoteThinking);
                }
              }
              break;
            }
            case 'tool_call': {
              if (onToolCall) {
                onToolCall(part);
              }
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
  };
}
