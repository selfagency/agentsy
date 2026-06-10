import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

/**
 * Patterns that match common secret formats.
 *
 * @internal
 */
const SECRET_PATTERNS: { pattern: RegExp; id: string; severity: 'critical' | 'high' }[] = [
  // AWS keys
  { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, id: 'aws-access-key', severity: 'critical' },
  // GitHub tokens (classic)
  { pattern: /gh[ps]_[A-Za-z0-9]{36,}/g, id: 'github-token', severity: 'critical' },
  // GitLab tokens
  { pattern: /glpat-[A-Za-z0-9_-]{20,}/g, id: 'gitlab-token', severity: 'critical' },
  // Generic API keys (bearer, basic, token auth)
  {
    pattern: /(?:Bearer|bearer|api[-_]?key|apikey|api_key|token)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}/g,
    id: 'generic-api-key',
    severity: 'high'
  },
  // Slack tokens
  { pattern: /xox[baprs]-[A-Za-z0-9]{10,}/g, id: 'slack-token', severity: 'critical' },
  // Slack webhooks
  {
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
    id: 'slack-webhook',
    severity: 'critical'
  },
  // Private keys (inline)
  {
    pattern: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY-----/g,
    id: 'private-key',
    severity: 'critical'
  },
  // JWT tokens (basic structure check)
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    id: 'jwt-token',
    severity: 'high'
  },
  // Stripe keys
  { pattern: /sk_live_[A-Za-z0-9]{20,}/g, id: 'stripe-live-key', severity: 'critical' },
  // Discord bot tokens
  {
    pattern: /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g,
    id: 'discord-token',
    severity: 'critical'
  }
];

/**
 * Scanner that detects secrets and credentials in model output.
 *
 * @remarks
 * Designed for **output**-phase scanning to prevent data leakage of
 * API keys, tokens, and private keys in LLM responses.
 *
 * OWASP: ASI-08 (Data Leakage)
 */
export class SecretDetectionScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/secret-detection',
    name: 'Secret Detection Scanner',
    version: '1.0.0',
    description: 'Detects secrets and credentials in LLM output',
    priority: 20,
    owaspCategories: ['asi-08'] as const,
    tags: ['secrets', 'credentials', 'data-leakage', 'compliance']
  };

  evaluate(input: string, _context?: Record<string, unknown>): Promise<GuardrailResult> {
    const detections: Detection[] = [];

    for (const { pattern, id, severity } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
      while ((match = pattern.exec(input)) !== null) {
        detections.push({
          id,
          description: `Secret detected: ${id}`,
          severity
        });
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    if (detections.length === 0) {
      return Promise.resolve({ status: 'pass', phase: 'output' });
    }

    return Promise.resolve({
      status: 'block',
      phase: 'output',
      reason: `Secret detected: ${detections.map(d => d.id).join(', ')}`,
      detections
    });
  }
}
