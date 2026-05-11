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

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown) => void,
  ): Promise<T> {
    return this.performRetryWithBackoff(operation, onRetry);
  }

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

    onRetry?.(attempt, error);

    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
  }

  public getMaxRetries(): number {
    return this.maxRetries;
  }

  public getDelayMs(): number {
    return this.delayMs;
  }

  public getCancellationToken(): CancellationToken {
    return this.cancellationToken;
  }
}

export function createRetryUtility(
  maxRetries: number,
  delayMs: number,
  cancellationToken: CancellationToken,
): RetryUtility {
  return new RetryUtility(maxRetries, delayMs, cancellationToken);
}
