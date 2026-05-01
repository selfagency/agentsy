import type { BaseRendererOptions, RendererHandle, ThinkingStyle } from '../types.js';
import { LLMStreamProcessor } from '../../processor/LLMStreamProcessor.js';
import type { StreamChunk, OutputPart } from '../../processor/LLMStreamProcessor.js';
import { appendToBlockquote } from '../../markdown/appendToBlockquote.js';

/**
 * Structural interface matching VS Code's ChatResponseStream.
 * Stable API methods are required; proposed API methods are optional (capability detection).
 * Allows renderer to work with actual VS Code ChatResponseStream without hard dependency on vscode module.
 */
export interface ChatResponseStream {
  /** Emit markdown content to the chat response. */
  markdown(content: string): void;

  /** Emit a progress indicator (e.g., for thinking blocks). */
  progress(content: string): void;

  /** Anchor to a file or symbol. */
  anchor(
    value:
      | { scheme: string; path: string }
      | {
          uri: { scheme: string; path: string };
          range: { start: { line: number; character: number }; end: { line: number; character: number } };
        },
    title?: string,
  ): void;

  /** Reference a file, location, or variable. */
  reference(
    value:
      | { scheme: string; path: string }
      | {
          uri: { scheme: string; path: string };
          range: { start: { line: number; character: number }; end: { line: number; character: number } };
        }
      | { variableName: string; value?: { scheme: string; path: string } },
    iconPath?:
      | { scheme: string; path: string }
      | { light: { scheme: string; path: string }; dark: { scheme: string; path: string } },
  ): void;

  /** Emit a button that runs a command. */
  button(command: { command: string; title: string; arguments?: unknown[] }): void;

  /** Emit a file tree. */
  filetree(value: Array<{ name: string; children?: unknown[] }>, baseUri: { scheme: string; path: string }): void;

  /** Push a response part (stable or proposed). */
  push?(part: unknown): void;

  // Proposed API methods (optional, capability-detection pattern)

  /** Emit thinking progress (proposed API). */
  thinkingProgress?(delta: { text?: string | string[]; id?: string; metadata?: Record<string, unknown> }): void;

  /** Begin a tool invocation (proposed API). */
  beginToolInvocation?(toolCallId: string, toolName: string, streamData?: unknown): void;

  /** Update a tool invocation (proposed API). */
  updateToolInvocation?(toolCallId: string, streamData: unknown): void;

  /** Report token usage (proposed API). */
  usage?(usage: { promptTokens: number; completionTokens: number; outputBuffer?: number }): void;
}

/**
 * Options for the VS Code chat renderer.
 */
export interface VSCodeChatRendererOptions extends BaseRendererOptions {
  /** VS Code ChatResponseStream instance. Required. */
  stream: ChatResponseStream;

  /** How to render thinking blocks. Default: 'blockquote'. */
  thinkingStyle?: ThinkingStyle;
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
  const {
    stream,
    showThinking = false,
    thinkingStyle = 'blockquote',
    processor,
    onError,
    onToolCall,
    onToolCallDelta,
    onFinish,
  } = options;

  if (!stream) {
    throw new Error('ChatResponseStream is required for VS Code chat renderer');
  }

  // Create processor if not provided (owns it internally)
  const llmProcessor = processor || new LLMStreamProcessor();

  // Guard flag to prevent double onFinish callback invocation
  let finished = false;

  let blockquoteThinkingStarted = false; // Track if blockquote header already emitted
  let blockquoteNeedsPrefix = true; // Track if next chunk needs blockquote prefix

  /**
   * Handle text part: stream markdown to the response.
   * @internal
   */
  function handleTextPart(text: string): void {
    stream.markdown(text);
  }

  /**
   * Handle thinking part: stream based on configured style.
   * @internal
   */
  function handleThinkingPart(text: string): void {
    if (!showThinking || thinkingStyle === 'suppress') {
      return;
    }

    if (stream.thinkingProgress) {
      stream.thinkingProgress({ text, id: 'thinking' });
    } else if (thinkingStyle === 'progress') {
      stream.progress(text);
    } else {
      // Blockquote style with proper multi-line support
      if (!blockquoteThinkingStarted) {
        stream.markdown('\n\n> 💭 **Thinking**\n>\n');
        blockquoteThinkingStarted = true;
        blockquoteNeedsPrefix = true;
      }

      // Emit blockquote-formatted content, tracking if text ends with newline
      const blockquoteContent = appendToBlockquote(text, blockquoteNeedsPrefix);
      stream.markdown(blockquoteContent);

      // Next chunk needs prefix if current text ends with newline
      blockquoteNeedsPrefix = text.endsWith('\n');
    }
  }

  /**
   * Handle tool_call part: emit callback and invoke stream method if available.
   * @internal
   */
  function handleToolCallPart(part: OutputPart): void {
    if (part.type !== 'tool_call') {
      return;
    }
    if (onToolCall) {
      onToolCall(part);
    }
    if (stream.beginToolInvocation && typeof part.call?.id === 'string' && typeof part.call?.name === 'string') {
      stream.beginToolInvocation(part.call.id, part.call.name);
    }
  }

  /**
   * Handle tool_call_delta part: emit callback and update invocation if available.
   * @internal
   */
  function handleToolCallDeltaPart(part: OutputPart): void {
    if (part.type !== 'tool_call_delta') {
      return;
    }
    if (onToolCallDelta) {
      onToolCallDelta(part);
    }
    if (stream.updateToolInvocation && typeof part.id === 'string') {
      stream.updateToolInvocation(part.id, part);
    }
  }

  /**
   * Process all parts from output, dispatching to appropriate handlers.
   * @internal
   */
  function processParts(parts: OutputPart[]): void {
    for (const part of parts) {
      if (part.type === 'text') {
        handleTextPart(part.text);
      } else if (part.type === 'thinking') {
        handleThinkingPart(part.text);
      } else if (part.type === 'tool_call') {
        handleToolCallPart(part);
      } else if (part.type === 'tool_call_delta') {
        handleToolCallDeltaPart(part);
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

        // Fire onFinish callback if stream is done (guard against double invocation)
        if (chunk.done === true && !finished && onFinish) {
          finished = true;
          await onFinish(chunk.finishReason, chunk.usage);
        }

        // Capability detection: report usage if available
        if (chunk.done === true && chunk.usage && stream.usage) {
          stream.usage({
            promptTokens: chunk.usage.inputTokens ?? 0,
            completionTokens: chunk.usage.outputTokens ?? 0,
          });
        }

        // Close blockquote if stream ended and we were in blockquote thinking mode
        if (chunk.done === true && blockquoteThinkingStarted && thinkingStyle === 'blockquote') {
          stream.markdown('\n\n');
          blockquoteThinkingStarted = false;
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

      // Capability detection: report usage if available
      if (result?.done && result.usage && stream.usage) {
        stream.usage({
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
        });
      }

      // Close blockquote if stream ended and we were in blockquote thinking mode
      if (result?.done && blockquoteThinkingStarted && thinkingStyle === 'blockquote') {
        stream.markdown('\n\n');
        blockquoteThinkingStarted = false;
      }
    },
  };
}
