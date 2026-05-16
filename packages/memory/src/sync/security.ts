import type {
  CredentialSource,
  SecureSyncErrorEnvelope,
  SecureSyncErrorOptions,
} from "./types.js";

const SECRET_PATTERNS = [
  /sk_[a-z0-9_-]{8,}/giu,
  /api[_-]?key\s*[:=]\s*(?:"[^"]+"|'[^']+'|[^\s,;]+)/giu,
  /auth[_-]?token\s*[:=]\s*(?:"[^"]+"|'[^']+'|[^\s,;]+)/giu,
  /turso[_-]?auth[_-]?token\s*[:=]\s*(?:"[^"]+"|'[^']+'|[^\s,;]+)/giu,
  /token\s*[:=]\s*(?:"[^"]+"|'[^']+'|[^\s,;]+)/giu,
  /bearer\s+[a-z0-9._-]{10,}/giu,
  /libsql:\/\/[^\s:]+:[^@\s]+@/giu,
] as const;

const SAFE_CREDENTIAL_SOURCES = new Set<CredentialSource>([
  "environment",
  "injected",
]);

export function redactSyncSecrets(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    value
  );
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
  const message = error instanceof Error ? error.message : "Unknown sync error";

  return {
    code: options.code ?? "SYNC_ERROR",
    message: redactSyncSecrets(message),
    retryable: options.retryable,
    ...(options.diagnosticContext === undefined
      ? {}
      : {
          diagnosticContext: redactSyncSecrets(options.diagnosticContext),
        }),
  };
}
