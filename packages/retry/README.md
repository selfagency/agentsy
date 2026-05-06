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
import { withRetry } from '@agentsy/retry';
import { CancellationToken } from 'vscode';

const cancellationToken: CancellationToken = ...; // From your VS Code extension API

await withRetry(async () => {
  // Your async operation
}, {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  signal: cancellationToken && cancellationTokenToAbortSignal(cancellationToken),
  statusCodes: [429, 500, 502, 503, 504],
});
```

## API

### withRetry(fn: () => Promise<T>, options: RetryOptions & { maxAttempts: number }): Promise<T>

Retries the async function `fn` according to the options:

- `maxAttempts` - Maximum retry attempts
- `initialDelayMs` - Initial delay before retrying
- `maxDelayMs` - Max delay cap
- `backoffMultiplier` - Multiplier for backoff
- `signal` - AbortSignal to support cancellation
- `statusCodes` - List of HTTP status codes to retry for

Throws immediately for non-retryable errors or if cancellation is requested.

## License

MIT
