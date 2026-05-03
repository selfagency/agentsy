import type { BaseRendererOptions, ThinkingStyle } from '../types.js';
import type { ChatResponseStream } from './createVSCodeChatRenderer.js';
import { createVSCodeChatRenderer } from './createVSCodeChatRenderer.js';

/**
 * Options for VS Code agent loop renderer.
 */
export interface VSCodeAgentLoopOptions extends BaseRendererOptions {
  /** VS Code ChatResponseStream instance. Required. */
  stream: ChatResponseStream;

  /** How to render thinking blocks. Default: 'blockquote'. */
  thinkingStyle?: ThinkingStyle;

  /** Optional abort signal for stream cancellation. */
  abortSignal?: AbortSignal;
}

/**
 * Create a VS Code renderer optimized for multi-step agent loops.
 *
 * This factory simplifies setting up a renderer for agent-based chat where
 * the agent executes multiple steps (tool calls, reflection, etc.) and streams
 * intermediate results back to the user.
 *
 * **Differences from createVSCodeChatRenderer:**
 * - Default `showThinking: true` (agent thinking is typically relevant)
 * - Supports optional `abortSignal` for external cancellation control
 * - Better integration with agent workflow callbacks
 *
 * @param options - Configuration options (stream required)
 * @returns A renderer handle suitable for agent loops
 *
 * @example
 * ```typescript
 * import { createVSCodeAgentLoop } from '@selfagency/llm-stream-parser/renderers/vscode';
 *
 * export async function handleAgentChat(
 *   request: vscode.ChatRequest,
 *   context: vscode.ChatContext,
 *   stream: vscode.ChatResponseStream,
 *   token: vscode.CancellationToken,
 * ) {
 *   const abortSignal = cancellationTokenToAbortSignal(token);
 *
 *   const renderer = createVSCodeAgentLoop({
 *     stream,
 *     showThinking: true, // Show agent reasoning steps
 *     thinkingStyle: 'progress', // Use progress indicators for thinking
 *     abortSignal,
 *     onToolCall: (toolCall) => {
 *       // Handle tool invocation in agent workflow
 *     },
 *     onFinish: (reason, usage) => {
 *       // Log completion stats
 *     },
 *   });
 *
 *   // Run agent steps, streaming each to the renderer
 *   for await (const output of agent.run(request.prompt, { signal: abortSignal })) {
 *     await renderer.writeChunk(output);
 *   }
 *   await renderer.end();
 * }
 * ```
 */
export function createVSCodeAgentLoop(options: VSCodeAgentLoopOptions) {
  // Default showThinking to true for agent loops (agent thinking is valuable context)
  const mergedOptions = {
    ...options,
    showThinking: options.showThinking !== false,
  };

  // Create the base renderer
  const renderer = createVSCodeChatRenderer(mergedOptions);

  let endPromise: Promise<void> | null = null;
  let detachAbortListener: (() => void) | undefined;
  /**
   * Ends the renderer exactly once, cleaning up resources and abort listeners.
   * Errors during cleanup are logged but not thrown because the stream is already terminating.
   *
   * @returns Promise that resolves when cleanup is complete
   * @internal
   */
  const endOnce = async (): Promise<void> => {
    if (endPromise) {
      return endPromise;
    }

    detachAbortListener?.();
    detachAbortListener = undefined;

    endPromise = renderer.end().finally(() => {
      detachAbortListener?.();
      detachAbortListener = undefined;
    });

    return endPromise;
  };

  // If abortSignal provided, attach cancellation listener to cleanup resources
  const abortSignal = options.abortSignal;
  if (abortSignal) {
    const onAbort = () => {
      // Signal end to renderer on cancellation
      endOnce().catch(err => {
        // Log but don't throw (signal already aborted)
        // Include error stack for debugging cleanup issues
        console.warn('[VS Code Agent Loop] Error during cancellation cleanup:', err);
        if (err instanceof Error && err.stack) {
          console.warn('[VS Code Agent Loop] Cleanup error stack:', err.stack);
        }
      });
    };

    if (abortSignal.aborted) {
      onAbort();
    } else {
      abortSignal.addEventListener('abort', onAbort, { once: true });
      detachAbortListener = () => {
        abortSignal.removeEventListener('abort', onAbort);
      };
    }
  }

  return {
    write: renderer.write,
    writeChunk: renderer.writeChunk,
    end: endOnce,
  };
}
