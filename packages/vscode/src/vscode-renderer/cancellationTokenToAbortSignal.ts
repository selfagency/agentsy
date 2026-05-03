import type { CancellationToken } from '@selfagency/llm-stream-parser/renderers';

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
 * import { createVSCodeChatRenderer, cancellationTokenToAbortSignal } from '@agentsy/vscode';
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
  if (token.isCancellationRequested) {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  }

  const controller = new AbortController();
  const cancellationListener = token.onCancellationRequested(() => {
    controller.abort();
    cancellationListener.dispose();
  });

  return controller.signal;
}
