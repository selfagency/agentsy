/**
 * VS Code-specific retry utilities.
 * This module provides helpers for integrating retry utilities with VS Code's CancellationToken API.
 */

import type { CancellationToken } from 'vscode';

/**
 * Converts a VS Code CancellationToken to an AbortSignal.
 * This allows VS Code-specific code to use framework-agnostic retry utilities.
 *
 * @param token - The VS Code CancellationToken to convert
 * @returns An AbortSignal that will be aborted when the token is cancelled
 *
 * @example
 * ```ts
 * import { CancellationToken } from 'vscode';
 * import { cancellationTokenToAbortSignal } from '@agentsy/vscode/utils/retry';
 * import { withRetry } from '@agentsy/retry';
 *
 * const token = new CancellationTokenSource().token;
 * const signal = cancellationTokenToAbortSignal(token);
 *
 * await withRetry(async () => {
 *   return await someOperation();
 * }, { maxAttempts: 3, signal });
 * ```
 */
export function cancellationTokenToAbortSignal(token: CancellationToken): AbortSignal {
  const controller = new AbortController();
  
  // VS Code CancellationToken uses an event emitter pattern
  // For VS Code 1.80+, we use the new API
  if (typeof token.onCancellationRequested === 'function') {
    const disposable = token.onCancellationRequested(() => {
      controller.abort();
    });
    // Store cleanup reference for disposal
    (controller as unknown as { __disposable?: { dispose: () => void } }).__disposable = disposable;
  } else if (token.isCancellationRequested) {
    // Token is already cancelled
    controller.abort();
  }
  
  return controller.signal;
}
