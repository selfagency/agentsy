export interface TimingOptions {
  timeout?: number;
  delay?: number;
  retries?: number;
  backoff?: 'linear' | 'exponential';
}

export const TimingUtils = {
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  },

  async retry<T>(operation: () => Promise<T>, options: TimingOptions = {}): Promise<T> {
    const { retries = 3, backoff = 'exponential', delay = 1000 } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        if (attempt === retries) {
          throw errorObj;
        }

        const backoffDelay = this.calculateBackoffDelay(attempt, delay, backoff);
        await this.delay(backoffDelay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Retry operation failed unexpectedly');
  },

  calculateBackoffDelay(attempt: number, baseDelay: number, strategy: 'linear' | 'exponential'): number {
    switch (strategy) {
      case 'linear':
        return baseDelay * (attempt + 1);
      case 'exponential':
        return baseDelay * 2 ** attempt;
      default:
        return baseDelay;
    }
  },

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ${seconds % 60}s`;
    }

    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
};

export class Debouncer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly delay: number,
    private readonly fn: (...args: unknown[]) => void
  ) {}

  debounce(...args: unknown[]): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.fn(...args);
      this.timeoutId = null;
    }, this.delay);
  }

  cancel(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export class Throttle {
  private lastExecution = 0;
  private pendingExecution: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly interval: number,
    private readonly fn: (...args: unknown[]) => void
  ) {}

  throttle(...args: unknown[]): void {
    const now = Date.now();

    if (now - this.lastExecution >= this.interval) {
      this.execute(...args);
    } else if (this.pendingExecution === null) {
      this.pendingExecution = setTimeout(
        () => {
          this.execute(...args);
          this.pendingExecution = null;
        },
        this.interval - (now - this.lastExecution)
      );
    }
  }

  private execute(...args: unknown[]): void {
    this.lastExecution = Date.now();
    this.fn(...args);
  }

  cancel(): void {
    if (this.pendingExecution !== null) {
      clearTimeout(this.pendingExecution);
      this.pendingExecution = null;
    }
  }
}
