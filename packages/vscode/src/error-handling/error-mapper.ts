import { ErrorCodeToMessage, ProviderErrorCode } from '../types/errors.js';

const STATUS_TO_ERROR_CODE = new Map<number, ProviderErrorCode>([
  [401, ProviderErrorCode.InvalidApiKey],
  [403, ProviderErrorCode.InvalidApiKey],
  [429, ProviderErrorCode.RateLimited],
  [404, ProviderErrorCode.ModelNotFound],
  [408, ProviderErrorCode.Timeout],
  [504, ProviderErrorCode.Timeout],
  [400, ProviderErrorCode.InvalidRequest]
]);

/**
 * Maps HTTP status codes to ProviderErrorCode values.
 */
export function httpStatusToErrorCode(status: number): ProviderErrorCode {
  const code = STATUS_TO_ERROR_CODE.get(status);
  return code ?? ProviderErrorCode.InternalError;
}

/**
 * Extracts a string representation from an unknown error value.
 */
function extractErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
  return String(error);
}

/**
 * Maps a generic unknown error to a ProviderErrorCode.
 * Inspects error messages for common patterns.
 */
export function errorToProviderCode(error: unknown): ProviderErrorCode {
  if (error == null) {
    return ProviderErrorCode.InternalError;
  }

  if (typeof error === 'object' && 'status' in error) {
    const { status } = error;
    if (typeof status === 'number') {
      return httpStatusToErrorCode(status);
    }
  }

  const message = extractErrorString(error).toLowerCase();

  // Pattern-based error matching with early returns to reduce complexity
  const patterns: [string[], ProviderErrorCode][] = [
    [['invalid api key', 'unauthorized', 'authentication'], ProviderErrorCode.InvalidApiKey],
    [['rate limit', 'too many requests', '429'], ProviderErrorCode.RateLimited],
    [['model not found', 'no such model'], ProviderErrorCode.ModelNotFound],
    [['context length', 'token limit', 'too long'], ProviderErrorCode.ContextLengthExceeded],
    [['econnrefused', 'connection refused', 'network', 'fetch failed'], ProviderErrorCode.ConnectionError],
    [['timeout', 'timed out', 'etimedout'], ProviderErrorCode.Timeout],
    [['cancelled', 'aborted'], ProviderErrorCode.Cancelled],
    [['invalid request', 'bad request'], ProviderErrorCode.InvalidRequest]
  ];

  for (const [keywords, code] of patterns) {
    if (keywords.some(kw => message.includes(kw))) {
      return code;
    }
  }

  return ProviderErrorCode.InternalError;
}

/**
 * Get user-friendly message for an error code.
 */
export function errorCodeToMessage(code: ProviderErrorCode): string {
  return ErrorCodeToMessage[code] ?? ErrorCodeToMessage[ProviderErrorCode.InternalError];
}

export interface CreateProviderErrorOptions {
  /** Attach provider error code metadata to the error object and message prefix. */
  attachCode?: boolean;
  /** Include details from the original runtime error message in the returned message. */
  preserveOriginalMessage?: boolean;
}

/**
 * Build a standardized Error from a provider error code and optional original error.
 */
export function createProviderError(
  code: ProviderErrorCode,
  originalError?: unknown,
  options: CreateProviderErrorOptions = {}
): Error {
  const baseMessage = errorCodeToMessage(code);
  const originalMessage =
    options.preserveOriginalMessage && originalError != null ? extractErrorString(originalError) : null;
  const messageWithOriginal =
    originalMessage && originalMessage.length > 0 ? `${baseMessage} (original: ${originalMessage})` : baseMessage;
  const message = options.attachCode ? `[${code}] ${messageWithOriginal}` : messageWithOriginal;
  const error = new Error(message);
  error.name = `ProviderError[${code}]`;
  if (options.attachCode) {
    (error as Error & { code?: ProviderErrorCode }).code = code;
  }
  if (originalError instanceof Error) {
    error.cause = originalError;
  }
  return error;
}
