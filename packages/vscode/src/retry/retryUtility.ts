import type { CancellationToken } from 'vscode';

/**
 * Retry ownership guidance and utility for managing retry operations
 * in VS Code extensions using @agentsy packages.
 */
export class RetryUtility {
  private maxRetries: number;
  private delayMs: number;
  private cancellationToken: CancellationToken;

  constructor(maxRetries: number, delayMs: number, cancellationToken: CancellationToken) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
    this.cancellationToken = cancellationToken;
  }

  /**
   * Executes an operation with retry logic.
   * @param operation The operation to execute
   * @param onRetry Optional callback when a retry occurs
   * @returns Promise that resolves with the operation result or rejects with the final error
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<T> {
    let lastError: unknown;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      if (this.cancellationToken.isCancellationRequested) {
        throw new Error('Operation cancelled');
      }

      try {
        attempt++;
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries) {
          if (onRetry) {
            onRetry(attempt, error);
          }

          // Wait before retrying
          if (this.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delayMs));
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Gets the maximum number of retry attempts.
   */
  public getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Gets the delay between retry attempts in milliseconds.
   */
  public getDelayMs(): number {
    return this.delayMs;
  }

  /**
   * Gets the cancellation token.
   */
  public getCancellationToken(): CancellationToken {
    return this.cancellationToken;
  }
}

/**
 * Factory function to create a RetryUtility instance.
 */
export function createRetryUtility(
  maxRetries: number,
  delayMs: number,
  cancellationToken: CancellationToken,
): RetryUtility {
  return new RetryUtility(maxRetries, delayMs, cancellationToken);
}
