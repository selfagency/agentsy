import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

/**
 * Path traversal patterns (block severity).
 *
 * @internal
 */
const BLOCK_PATTERNS: { pattern: RegExp; id: string }[] = [
  // Path traversal with consecutive parent refs
  { pattern: /(?:\.\.[/\\]){2,}/g, id: 'deep-traversal' },
  // Single parent ref traversal
  { pattern: /\.\.[/\\]/g, id: 'path-traversal' },
  // Encoded traversal
  { pattern: /\.\.%2[fF]/g, id: 'encoded-traversal' },
  // Null bytes
  { pattern: /\0/g, id: 'null-byte' }
];

/**
 * Sensitive path patterns (block severity).
 *
 * @internal
 */
const SENSITIVE_PATTERNS: { pattern: RegExp; id: string }[] = [
  // SSH keys
  { pattern: /~?\.ssh\b/g, id: 'sensitive-path' },
  // AWS credentials
  { pattern: /~?\.aws\b/g, id: 'sensitive-path' },
  // GCP credentials
  { pattern: /~?\.gcp\b/g, id: 'sensitive-path' },
  // Kubernetes config
  { pattern: /~?\.kube\b/g, id: 'sensitive-path' },
  // Proc filesystem
  { pattern: /\/proc\/self\//g, id: 'sensitive-path' },
  // Shadow/passwd files
  { pattern: /\/(?:etc\/shadow|etc\/passwd)\b/g, id: 'sensitive-path' },
  // Symlink-planting locations (bare paths under temp dirs without file extensions)
  { pattern: /\/(?:tmp|var\/tmp|dev\/shm)\/\w+(?!\.\w+\b)\b/g, id: 'sensitive-path' }
];

/**
 * Suspicious patterns (escalate severity).
 *
 * @internal
 */
const SUSPICIOUS_PATTERNS: { pattern: RegExp; id: string }[] = [
  // Windows absolute paths
  { pattern: /\b[A-Za-z]:[/\\]/g, id: 'windows-absolute-path' },
  // Suspicious dot sequences (not clean traversal)
  { pattern: /\.{4,}/g, id: 'suspicious-path' }
];

/**
 * Extract detections from pattern matches.
 *
 * @internal
 */
function collectDetections(
  patterns: { pattern: RegExp; id: string }[],
  input: string,
  severity: 'critical' | 'high' | 'medium',
  description: string
): Detection[] {
  const detections: Detection[] = [];
  for (const { pattern, id } of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
    while ((match = pattern.exec(input)) !== null) {
      detections.push({ id, description, severity });
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }
  return detections;
}

/**
 * Scanner that detects path traversal and sanitization issues.
 *
 * @remarks
 * Scans tool arguments for path traversal patterns, null bytes,
 * and absolute paths where relative is expected.
 *
 * OWASP: ASI-04 (Insecure Tool Execution), ASI-06 (Insecure Data Handling)
 */
export class PathSanitizationScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/path-sanitization',
    name: 'Path Sanitization Scanner',
    version: '1.0.0',
    description: 'Detects path traversal and injection in tool arguments',
    priority: 15,
    owaspCategories: ['asi-06'] as const,
    tags: ['path-traversal', 'injection', 'filesystem']
  };

  evaluate(input: string, _context?: Record<string, unknown>): Promise<GuardrailResult> {
    const traversalDetections = collectDetections(BLOCK_PATTERNS, input, 'critical', 'Path traversal:');
    const sensitiveDetections = collectDetections(SENSITIVE_PATTERNS, input, 'critical', 'Sensitive path:');
    const suspiciousDetections = collectDetections(SUSPICIOUS_PATTERNS, input, 'medium', 'Suspicious path:');

    if (traversalDetections.length > 0) {
      return Promise.resolve({
        status: 'block',
        phase: 'tool-input',
        reason: 'Path traversal detected',
        detections: traversalDetections
      });
    }

    if (sensitiveDetections.length > 0) {
      return Promise.resolve({
        status: 'block',
        phase: 'tool-input',
        reason: 'Sensitive path blocked',
        detections: sensitiveDetections
      });
    }

    if (suspiciousDetections.length > 0) {
      return Promise.resolve({
        status: 'escalate',
        phase: 'tool-input',
        riskScore: suspiciousDetections.length * 0.3,
        reason: 'Suspicious path pattern',
        detections: suspiciousDetections
      });
    }

    return Promise.resolve({ status: 'pass', phase: 'tool-input' });
  }
}
