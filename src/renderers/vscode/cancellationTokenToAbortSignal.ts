import type { CancellationToken } from '../types.js';

/**
 * Convert a VS Code CancellationToken to an AbortSignal for use with fetch, stream operations,
 * or other APIs that accept AbortSignal.
 *
 * This utility allows VS Code renderers to integrate with the host's cancellation mechanism,
 * enabling graceful cleanup when the user cancels a chat response or navigation.
 *
 * @param token - VS Code CancellationToken from chat context
 * @returns An AbortSignal that reflects the token's cancellation state
 *
 * @example
 * ```typescript
 * import { createVSCodeChatRenderer } from '@selfagency/llm-stream-parser/renderers/vscode';
 * import { cancellationTokenToAbortSignal } from '@selfagency/llm-stream-parser/renderers/vscode';
 *
 * export async function handleChat(
 *   request: vscode.ChatRequest,
 *   context: vscode.ChatContext,
 *   stream: vscode.ChatResponseStream,
 *   token: vscode.CancellationToken,
 * ) {
 *   const abortSignal = cancellationTokenToAbortSignal(token);
 *
 *   // Use with fetch
 *   const response = await fetch(url, { signal: abortSignal });
 *
 *   // Or with renderer
 *   const renderer = createVSCodeChatRenderer({ stream });
 *   // ... pass abortSignal to streaming operations
 * }
 * ```
 */
export function cancellationTokenToAbortSignal(token: CancellationToken): AbortSignal {
  // If token is already cancelled, return pre-aborted signal
  if (token.isCancellationRequested) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }

  // Create controller and link to token's cancellation event
  const controller = new AbortController();
  const cancellationListener = token.onCancellationRequested(() => {
    controller.abort();
    cancellationListener.dispose();
  });

  return controller.signal;
}
