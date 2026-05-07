# @agentsy/retry

A robust retry utility package providing:

- Async retry with exponential backoff
- Cancellation support via VS Code CancellationToken and AbortSignal
- Configurable retry limit, delay, max delay, and retryable HTTP status codes

## Installation

Install from the monorepo workspace:

```bash
pnpm add @agentsy/retry
```

## Usage

```ts
import { withRetry, retryWithBackoff } from '@agentsy/retry';

// Standard usage with AbortSignal
const abortController = new AbortController();

await withRetry(
  async () => {
    // Your async operation
  },
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    signal: abortController.signal,
    statusCodes: [429, 500, 502, 503, 504],
  },
);

// Alternative export name (alias)
await retryWithBackoff(
  async () => {
    // Your async operation
  },
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    statusCodes: [429, 500, 502, 503, 504],
  },
);
```

### VS Code Integration

For VS Code extensions, use the helper from `@agentsy/vscode/utils/retry.js`:

```ts
import { withRetry } from '@agentsy/retry';
import { cancellationTokenToAbortSignal } from '@agentsy/vscode/utils/retry.js';
import { CancellationToken } from 'vscode';

const cancellationToken: CancellationToken = ...; // From your VS Code extension API

await withRetry(async () => {
  // Your async operation
}, {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  signal: cancellationTokenToAbortSignal(cancellationToken),
  statusCodes: [429, 500, 502, 503, 504],
});
```

## API

### withRetry(fn: () => Promise<T>, options: RetryOptions & { maxAttempts: number }): Promise<T>

Retries the async function `fn` according to the options:

- `maxAttempts` - Maximum retry attempts (required)
- `initialDelayMs` - Initial delay before retrying (default: 1000ms)
- `maxDelayMs` - Maximum delay cap (default: 60000ms)
- `backoffMultiplier` - Multiplier for exponential backoff (default: 2)
- `signal` - AbortSignal to support cancellation (optional)
- `statusCodes` - List of HTTP status codes to retry for (default: [429, 500, 502, 503, 504])

Throws immediately for non-retryable errors or if cancellation is requested.

### retryWithBackoff(fn: () => Promise<T>, options: RetryOptions & { maxAttempts: number }): Promise<T>

Alias for `withRetry`. Maintains API compatibility with existing code and documentation.

## License

MIT
