import type { CredentialSource, SecureSyncErrorEnvelope, SecureSyncErrorOptions } from './types.js';

const SECRET_PATTERN =
  /(sk_[a-z0-9_-]{8,}|api[_-]?key\s*=\s*\S+|bearer\s+[a-z0-9._-]{10,}|libsql:\/\/[^\s:]+:[^@\s]+@)/giu;

const SAFE_CREDENTIAL_SOURCES = new Set<CredentialSource>(['environment', 'injected']);

export function redactSyncSecrets(value: string): string {
  return value.replace(SECRET_PATTERN, '[REDACTED]');
}

export function validateCredentialSource(source: CredentialSource): void {
  if (!SAFE_CREDENTIAL_SOURCES.has(source)) {
    throw new Error(
      `Unsafe credential source: ${source}. Sync credentials must come from an approved credential source.`
    );
  }
}

export function createSecureSyncErrorEnvelope(
  error: unknown,
  options: SecureSyncErrorOptions
): SecureSyncErrorEnvelope {
  const message = error instanceof Error ? error.message : 'Unknown sync error';

  return {
    code: options.code ?? 'SYNC_ERROR',
    message: redactSyncSecrets(message),
    retryable: options.retryable,
    ...(options.diagnosticContext === undefined
      ? {}
      : {
          diagnosticContext: redactSyncSecrets(options.diagnosticContext)
        })
  };
}
