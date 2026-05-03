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

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('invalid api key') || message.includes('unauthorized') || message.includes('authentication')) {
    return ProviderErrorCode.InvalidApiKey;
  }
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return ProviderErrorCode.RateLimited;
  }
  if (message.includes('model not found') || message.includes('no such model')) {
    return ProviderErrorCode.ModelNotFound;
  }
  if (message.includes('context length') || message.includes('token limit') || message.includes('too long')) {
    return ProviderErrorCode.ContextLengthExceeded;
  }
  if (message.includes('econnrefused') || message.includes('connection refused') || message.includes('network') || message.includes('fetch failed')) {
    return ProviderErrorCode.ConnectionError;
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return ProviderErrorCode.Timeout;
  }
  if (message.includes('cancelled') || message.includes('aborted')) {
    return ProviderErrorCode.Cancelled;
  }
  if (message.includes('invalid request') || message.includes('bad request')) {
    return ProviderErrorCode.InvalidRequest;
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
