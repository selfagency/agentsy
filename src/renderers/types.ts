import type { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';

/**
 * Tool call output part (not rendered, only passed to callbacks).
 */
export interface ToolCallPart {
  type: 'tool_call';
  call: XmlToolCall;
}

/**
 * Tool call handler callback.
 */
export type OnToolCall = (part: ToolCallPart) => void;

/**
 * Options common to all renderers.
 */
export interface BaseRendererOptions {
  /** Whether to include thinking blocks in output. @default false */
  showThinking?: boolean;

  /** Optional processor instance; if not provided, renderer creates one internally. */
  processor?: LLMStreamProcessor;

  /** Optional callback fired when an error occurs during rendering. */
  onError?: (error: Error) => void;

  /** Optional callback fired when a tool call is encountered (not rendered as content). */
  onToolCall?: OnToolCall;
}

/**
 * Thinking block rendering style options.
 */
export type ThinkingStyle = 'blockquote' | 'progress' | 'suppress';

/**
 * Generic renderer handle: write-stream-like interface for composable pipelines.
 */
export interface RendererHandle {
  /**
   * Process a chunk of streamed data.
   * @param chunk - The data chunk to process.
   * @returns Promise that resolves when the chunk is processed.
   */
  write(chunk: string): Promise<void>;

  /**
   * Signal end of stream. Flushes any buffered content.
   * @returns Promise that resolves when the stream is finalized.
   */
  end(): Promise<void>;
}

/**
 * Output target for renderers that emit text (plain, CLI).
 * Can be a Node.js WritableStream or a callback function.
 */
export type TextOutput = NodeJS.WritableStream | ((text: string) => void);
