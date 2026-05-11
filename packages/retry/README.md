# @agentsy/retry

Retry utilities with bounded attempts and backoff support. Supports exponential backoff, configurable delays, and AbortSignal cancellation.

## Status

Internal package; intended for resilient operation wrappers.

## Usage

### Basic Retry

```typescript
import { retry } from '@agentsy/retry';

const result = await retry(
  async () => {
    return await someUnreliableOperation();
  },
  {
    maxAttempts: 5,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2, // exponential backoff: 1s, 2s, 4s, 8s, ...
  },
);
```

### With AbortSignal

Cancel retries at any time using an AbortSignal:

```typescript
const controller = new AbortController();

const retryPromise = retry(
  async () => {
    return await someUnreliableOperation();
  },
  {
    maxAttempts: 10,
    signal: controller.signal, // Pass AbortSignal
  },
);

// Cancel retries if needed
controller.abort(); // Immediately rejects with AbortError
```

## API

### `retry<T>(fn, options): Promise<T>`

Retries the given async function with exponential backoff.

**Parameters:**

- `fn` - Async function to retry
- `options` - Configuration object:
  - `maxAttempts` (default: 3) - Maximum number of attempts
  - `initialDelay` (default: 1000) - Initial delay in milliseconds
  - `maxDelay` (default: 30000) - Maximum delay in milliseconds
  - `backoffFactor` (default: 2) - Exponential backoff multiplier
  - `signal` (optional) - AbortSignal for cancellation

**Returns:** Promise resolving to the function result, or rejecting if all attempts fail or signal aborts.

## Cancellation

Use `AbortSignal` to cancel retries immediately. This is useful for:

- Timeout scenarios: `AbortSignal.timeout(ms)`
- User-initiated cancellation: `AbortController`
- Cleanup on component unmount (React/frameworks)

```typescript
// With timeout
const result = await retry(fn, {
  signal: AbortSignal.timeout(5000), // Give up after 5 seconds total
});
```
