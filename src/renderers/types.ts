import type { LLMStreamProcessor, OutputPart, StreamChunk } from '../processor/LLMStreamProcessor.js';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import type { FinishReason } from '../tool-calls/types.js';
import type { UsageInfo } from '../normalizers/types.js';

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

  /** Optional callback fired for each streaming argument delta while a native tool call is assembling. */
  onToolCallDelta?: (delta: Extract<OutputPart, { type: 'tool_call_delta' }>) => void;

  /** Optional callback fired when the stream finishes with a finish reason and optional usage info. */
  onFinish?: (finishReason: FinishReason | undefined, usage: UsageInfo | undefined) => void | Promise<void>;

  /** Optional callback fired when the step index changes (e.g., between tool calls in an agent loop). */
  onStep?: (stepIndex: number, usage: UsageInfo | undefined) => void | Promise<void>;
}

/**
 * Thinking block rendering style options.
 * - 'blockquote': render thinking as a markdown blockquote
 * - 'progress': render thinking as a progress indicator
 * - 'suppress': do not render thinking even if showThinking is true
 */
export type ThinkingStyle = 'blockquote' | 'progress' | 'suppress';

/**
 * Structural interface matching VS Code's CancellationToken.
 * Allows renderers to support cancellation without hard dependency on vscode module.
 */
export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: (listener: (e: unknown) => void) => { dispose(): void };
}

/**
 * Generic renderer handle: write-stream-like interface for composable pipelines.
 */
export interface RendererHandle {
  /**
   * Process a chunk of streamed data (text).
   * @param chunk - The text data chunk to process.
   * @returns Promise that resolves when the chunk is processed.
   */
  write(chunk: string): Promise<void>;

  /**
   * Process a structured chunk of streamed data (raw stream output).
   * Provides pre-normalized content with thinking, tool calls, done signal, usage, and finish reason.
   * @param chunk - The StreamChunk to process.
   * @returns Promise that resolves when the chunk is processed.
   */
  writeChunk(chunk: StreamChunk): Promise<void>;

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
