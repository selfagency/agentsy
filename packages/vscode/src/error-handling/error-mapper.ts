import { ProviderErrorCode, ErrorCodeToMessage } from '../types/errors.js';

/**
 * Maps HTTP status codes to ProviderErrorCode values.
 */
export function httpStatusToErrorCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return ProviderErrorCode.InvalidApiKey;
  if (status === 429) return ProviderErrorCode.RateLimited;
  if (status === 404) return ProviderErrorCode.ModelNotFound;
  if (status === 408 || status === 504) return ProviderErrorCode.Timeout;
  if (status === 400) return ProviderErrorCode.InvalidRequest;
  if (status >= 500) return ProviderErrorCode.InternalError;
  return ProviderErrorCode.InternalError;
}

/**
 * Maps a generic unknown error to a ProviderErrorCode.
 * Inspects error messages for common patterns.
 */
export function errorToProviderCode(error: unknown): ProviderErrorCode {
  if (error == null) return ProviderErrorCode.InternalError;

  if (typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return httpStatusToErrorCode(status);
  }

  let errorStr: string;
  if (error instanceof Error) {
    errorStr = error.message;
  } else if (typeof error === 'string') {
    errorStr = error;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    errorStr = String((error as Record<string, unknown>).message);
  } else {
    errorStr = String(error);
  }
  const message = errorStr.toLowerCase();

  // Pattern-based error matching with early returns to reduce complexity
  const patterns: Array<[string[], ProviderErrorCode]> = [
    [['invalid api key', 'unauthorized', 'authentication'], ProviderErrorCode.InvalidApiKey],
    [['rate limit', 'too many requests', '429'], ProviderErrorCode.RateLimited],
    [['model not found', 'no such model'], ProviderErrorCode.ModelNotFound],
    [['context length', 'token limit', 'too long'], ProviderErrorCode.ContextLengthExceeded],
    [['econnrefused', 'connection refused', 'network', 'fetch failed'], ProviderErrorCode.ConnectionError],
    [['timeout', 'timed out', 'etimedout'], ProviderErrorCode.Timeout],
    [['cancelled', 'aborted'], ProviderErrorCode.Cancelled],
    [['invalid request', 'bad request'], ProviderErrorCode.InvalidRequest],
  ];

  for (const [keywords, code] of patterns) {
    if (keywords.some(kw => message.includes(kw))) return code;
  }

  return ProviderErrorCode.InternalError;
}

/**
 * Get user-friendly message for an error code.
 */
export function errorCodeToMessage(code: ProviderErrorCode): string {
  return ErrorCodeToMessage[code] ?? ErrorCodeToMessage[ProviderErrorCode.InternalError];
}

/**
 * Build a standardized Error from a provider error code and optional original error.
 */
export function createProviderError(code: ProviderErrorCode, originalError?: unknown): Error {
  const message = errorCodeToMessage(code);
  const error = new Error(message);
  error.name = `ProviderError[${code}]`;
  if (originalError instanceof Error) {
    error.cause = originalError;
  }
  return error;
}
