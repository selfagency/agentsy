import type { CancellationToken } from 'vscode';

/**
 * Retry ownership guidance and utility for managing retry operations
 * in VS Code extensions using @agentsy packages.
 */
export class RetryUtility {
  private readonly maxRetries: number;
  private readonly delayMs: number;
  private readonly cancellationToken: CancellationToken;

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
    return this.performRetryWithBackoff(operation, onRetry);
  }

  /**
   * Performs retry with a simple backoff strategy.
   * Extracted to reduce cognitive complexity of executeWithRetry.
   */
  private async performRetryWithBackoff<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<T> {
    let lastError: unknown;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      this.throwIfCancelled();

      try {
        attempt++;
        return await operation();
      } catch (error) {
        lastError = error;
        await this.handleRetry(attempt, error, onRetry);
      }
    }

    throw lastError;
  }

  private throwIfCancelled(): void {
    if (this.cancellationToken.isCancellationRequested) {
      throw new Error('Operation cancelled');
    }
  }

  private async handleRetry(
    attempt: number,
    error: unknown,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<void> {
    if (attempt >= this.maxRetries) {
      return;
    }

    if (onRetry) {
      onRetry(attempt, error);
    }

    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
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
