import type { CancellationToken } from 'vscode';

/**
 * Retry ownership guidance and utility for managing retry operations
 * in VS Code extensions using @agentsy packages.
 */
export class RetryUtility {
  private readonly maxRetries: number;
  private readonly delayMs: number;
  private readonly cancellationToken: CancellationToken;
  private readonly backoffFactor: number;

  constructor(maxRetries: number, delayMs: number, cancellationToken: CancellationToken, backoffFactor = 1) {
    this.maxRetries = maxRetries;
    this.delayMs = delayMs;
    this.cancellationToken = cancellationToken;
    this.backoffFactor = backoffFactor;
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown) => void
  ): Promise<T> {
    return await this.performRetryWithBackoff(operation, onRetry);
  }

  private async performRetryWithBackoff<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: unknown) => void
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

  private getDelayForAttempt(attempt: number): number {
    return Math.max(0, this.delayMs * this.backoffFactor ** Math.max(0, attempt - 1));
  }

  private async waitForDelay(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      if (this.cancellationToken.isCancellationRequested) {
        reject(new Error('Operation cancelled'));
        return;
      }

      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const subscription = this.cancellationToken.onCancellationRequested(() => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        subscription.dispose();
        reject(new Error('Operation cancelled'));
      });

      timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        subscription.dispose();
        resolve();
      }, delayMs);
    });
  }

  private async handleRetry(
    attempt: number,
    error: unknown,
    onRetry?: (attempt: number, error: unknown) => void
  ): Promise<void> {
    if (attempt >= this.maxRetries) {
      return;
    }

    onRetry?.(attempt, error);

    await this.waitForDelay(this.getDelayForAttempt(attempt));
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
  backoffFactor = 1
): RetryUtility {
  return new RetryUtility(maxRetries, delayMs, cancellationToken, backoffFactor);
}
