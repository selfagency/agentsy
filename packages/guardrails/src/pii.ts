import type { Detection, GuardrailPhase, GuardrailResult, GuardrailScanner } from './types.js';

/**
 * PII detection patterns.
 *
 * @internal
 */
const PII_PATTERNS: { pattern: RegExp; id: string }[] = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, id: 'email' },
  // Phone numbers (basic)
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    id: 'phone'
  },
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, id: 'ssn' },
  // Credit card numbers (Luhn-check skipped)
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, id: 'credit-card' },
  // IP addresses
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, id: 'ip-address' }
];

/**
 * Scanner that detects personally identifiable information.
 *
 * @remarks
 * Uses regex-based detection for email, phone, SSN, credit card, and IP.
 * Can be configured to block, warn, or redact matches.
 *
 * OWASP: ASI-06 (Insecure Data Handling), ASI-08 (Data Leakage)
 */
export class PIIScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/pii',
    name: 'PII Detection Scanner',
    version: '1.0.0',
    description: 'Detects personally identifiable information in input/output',
    priority: 25,
    owaspCategories: ['asi-06', 'asi-08'] as const,
    tags: ['pii', 'privacy', 'compliance', 'data-loss-prevention']
  };

  readonly #action: 'block' | 'warn' | 'redact';
  readonly #phase: GuardrailPhase;

  constructor(options?: { action?: 'block' | 'warn' | 'redact'; phase?: GuardrailPhase }) {
    this.#action = options?.action ?? 'warn';
    this.#phase = options?.phase ?? 'input';
  }

  evaluate(input: string, _context?: Record<string, unknown>): Promise<GuardrailResult> {
    const detections: Detection[] = [];

    for (const { pattern, id } of PII_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
      while ((match = pattern.exec(input)) !== null) {
        detections.push({
          id,
          description: `PII detected: ${id}`,
          severity: id === 'ssn' || id === 'credit-card' ? 'high' : 'medium'
        });
        // Avoid infinite loops on zero-length matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    if (detections.length === 0) {
      return Promise.resolve({ status: 'pass', phase: this.#phase });
    }

    switch (this.#action) {
      case 'block': {
        const categories = [...new Set(detections.map(d => d.id))];
        return Promise.resolve({
          status: 'block',
          phase: this.#phase,
          reason: `PII detected: ${categories.join(', ')}`,
          detections
        });
      }
      case 'redact': {
        let sanitized = input;
        for (const { pattern } of PII_PATTERNS) {
          pattern.lastIndex = 0;
          sanitized = sanitized.replace(pattern, (m: string) => {
            if (m.includes('@')) {
              return '[REDACTED-EMAIL]';
            }
            if (/\d{3}-\d{2}-\d{4}/.test(m)) {
              return '[REDACTED-SSN]';
            }
            if (/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/.test(m)) {
              return '[REDACTED-CC]';
            }
            return '[REDACTED]';
          });
        }
        return Promise.resolve({
          status: 'transform',
          phase: this.#phase,
          sanitized,
          detections
        });
      }
      default: {
        // warn action — escalate for human review
        return Promise.resolve({
          status: 'escalate',
          phase: this.#phase,
          reason: `PII detected: ${detections.map(d => d.id).join(', ')}`,
          riskScore: 0.6,
          detections
        });
      }
    }
  }
}
