const DEFAULT_SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g
];

export interface SecretsGuardOptions {
  readonly patterns?: readonly RegExp[];
  /** When true (default), throw on detected secrets. When false, just redact. */
  readonly strict?: boolean;
}

export interface SecretsGuardResult {
  readonly safe: boolean;
  readonly redacted: string;
  readonly violations: string[];
}

export function guardSecrets(input: string, options?: SecretsGuardOptions): SecretsGuardResult {
  const patterns = options?.patterns ?? DEFAULT_SECRET_PATTERNS;
  const violations: string[] = [];
  let redacted = input;

  for (const pattern of patterns) {
    // Reset lastIndex for global regexes to ensure full-string scanning.
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const matches = [...redacted.matchAll(re)];
    for (const match of matches) {
      const matched = match[0];
      violations.push(matched);
      redacted = redacted.split(matched).join('[SECRET_REDACTED]');
    }
  }

  return { redacted, safe: violations.length === 0, violations };
}

export function assertSecretsGuard(input: string, options?: SecretsGuardOptions): string {
  const result = guardSecrets(input, options);
  if (result.safe === false && options?.strict !== false) {
    throw new Error(
      `Secrets detected in sandbox input (${result.violations.length} violation(s)). Use environment variables instead.`
    );
  }
  return result.redacted;
}
