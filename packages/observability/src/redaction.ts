/**
 * Redaction Processor
 *
 * Concrete implementation of the RedactionPolicy interface.
 * Scrubs sensitive data (API keys, tokens, PII) from span attributes
 * and log messages before export.
 *
 * @module @agentsy/observability
 */

import type { RedactionPolicy, RedactionRule } from './core/types.js';

// ---------------------------------------------------------------------------
// Default secret patterns
// ---------------------------------------------------------------------------

export const SECRET_PATTERNS: RedactionRule[] = [
  {
    id: 'sk-api-key',
    description: 'OpenAI-style API key (sk-...)',
    pattern: /sk-[a-zA-Z0-9]{32,}/g,
    replacement: 'sk-[REDACTED]',
    severity: 'high',
    enabled: true
  },
  {
    id: 'aws-access-key',
    description: 'AWS access key (AKIA...)',
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: 'AKIA[REDACTED]',
    severity: 'high',
    enabled: true
  },
  {
    id: 'github-token',
    description: 'GitHub personal access token (ghp_...)',
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    replacement: 'ghp_[REDACTED]',
    severity: 'high',
    enabled: true
  },
  {
    id: 'email',
    description: 'Email address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL-REDACTED]',
    severity: 'medium',
    enabled: true
  },
  {
    id: 'ssn',
    description: 'US Social Security Number',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN-REDACTED]',
    severity: 'high',
    enabled: true
  }
];

// ---------------------------------------------------------------------------
// Default redaction policy
// ---------------------------------------------------------------------------

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  name: 'default',
  globalPatterns: SECRET_PATTERNS,
  providerRules: new Map(),
  redact(value: string): string {
    let result = value;
    for (const rule of this.globalPatterns) {
      if (rule.enabled) {
        result = result.replace(rule.pattern, rule.replacement);
      }
    }
    return result;
  }
};

/**
 * Creates a redaction policy with the given rules merged over defaults.
 */
export function createRedactionPolicy(
  overrides?: Partial<RedactionPolicy> & { extraPatterns?: RedactionRule[] }
): RedactionPolicy {
  const patterns = overrides?.extraPatterns ? [...SECRET_PATTERNS, ...overrides.extraPatterns] : SECRET_PATTERNS;

  return {
    name: overrides?.name ?? 'custom',
    globalPatterns: overrides?.globalPatterns ?? patterns,
    providerRules: overrides?.providerRules ?? new Map(),
    redact(value: string): string {
      let result = value;
      for (const rule of this.globalPatterns) {
        if (rule.enabled) {
          result = result.replace(rule.pattern, rule.replacement);
        }
      }
      return result;
    }
  };
}

/**
 * Redacts sensitive data from a string using the default policy.
 * Convenience function for one-off redaction.
 */
export function redactSecrets(value: string): string {
  return DEFAULT_REDACTION_POLICY.redact(value);
}
