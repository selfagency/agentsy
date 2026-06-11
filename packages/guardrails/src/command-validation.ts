import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

/**
 * Dangerous shell command patterns — critical severity.
 *
 * @internal
 */
const CRITICAL_PATTERNS: { pattern: RegExp; id: string }[] = [
  // Recursive directory deletion
  { pattern: /\brm\s+(?:-rf|--recursive\s+--force|-r\s+-f|-f\s+-r)\b/g, id: 'rm-dir' },
  // Recursive chmod
  { pattern: /\bchmod\s+-R\b/g, id: 'chmod-recursive' },
  // Recursive chown
  { pattern: /\bchown\s+-R\b/g, id: 'chown-recursive' },
  // Disk manipulation
  { pattern: /\bmkfs\b/g, id: 'mkfs' },
  { pattern: /\bdd\b/g, id: 'dd' },
  // Raw device write
  { pattern: />\s*\/dev\/sd[a-z]\b/g, id: 'raw-write' },
  // Process spawning API
  { pattern: /\b(?:child_process|spawn|exec|execSync|spawnSync)\./g, id: 'process-spawner' },
  // Pipe-to-shell: curl|wget then pipe to sh/bash/zsh
  // nosemgrep: use-bounded-regex — pipe symbol anchors the lazy quantifier
  { pattern: /\b(?:curl|wget)\s+[^|]*?\|\s*(?:bash|sh|zsh)\b/g, id: 'curl-pipe-shell' },
  // nosemgrep: use-bounded-regex — pipe symbol anchors the lazy quantifier
  { pattern: /\bwget\s+[^|]*?\|\s*(?:sh|bash|zsh)\b/g, id: 'wget-pipe-shell' },
  // Direct eval
  { pattern: /\beval\s*\(/g, id: 'eval' }
];

/**
 * High-severity command patterns — returned as escalate.
 *
 * @internal
 */
const HIGH_PATTERNS: { pattern: RegExp; id: string }[] = [
  { pattern: /\bkill\s+-9\b/g, id: 'process-control' },
  { pattern: /\bsudo\s+/g, id: 'privilege-escalation' },
  { pattern: /\bchmod\s+(?:777|a\+x|ugo\+w)\b/g, id: 'permission-escalation' },
  { pattern: /\bchown\s+(?:root|0)\b/g, id: 'ownership-change' },
  { pattern: /(?:curl|wget)\s+-[^\s]*O\s+/g, id: 'remote-file-download' },
  { pattern: /\b(?:iptables|ufw|nft)\s+/g, id: 'firewall-manipulation' }
];

/**
 * Scanner that validates shell commands for destructive or unsafe operations.
 *
 * @remarks
 * Designed for `tool-input` phase. Blocks destructive commands like
 * `rm -rf /`, pipe-to-shell patterns, and disk manipulation.
 *
 * OWASP: ASI-04 (Insecure Tool Execution)
 */
export class CommandValidationScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/command-validation',
    name: 'Command Validation Scanner',
    version: '1.0.0',
    description: 'Validates shell commands for destructive or unsafe operations',
    priority: 10,
    owaspCategories: ['asi-07'] as const,
    tags: ['command-injection', 'shell', 'destructive-operations']
  };

  evaluate(input: string, _context?: Record<string, unknown>): Promise<GuardrailResult> {
    const criticalDetections: Detection[] = [];
    const highDetections: Detection[] = [];

    for (const { pattern, id } of CRITICAL_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
      while ((match = pattern.exec(input)) !== null) {
        criticalDetections.push({
          id,
          description: `Critical unsafe command: ${id}`,
          severity: 'critical'
        });
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    for (const { pattern, id } of HIGH_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop with global regex
      while ((match = pattern.exec(input)) !== null) {
        highDetections.push({
          id,
          description: `High-risk command: ${id}`,
          severity: 'high'
        });
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    // Block if any critical pattern found
    if (criticalDetections.length > 0) {
      return Promise.resolve({
        status: 'block',
        phase: 'tool-input',
        reason: `Destructive command detected: ${criticalDetections.map(d => d.id).join(', ')}`,
        detections: [...criticalDetections, ...highDetections]
      });
    }

    // Escalate if high-severity patterns found
    if (highDetections.length > 0) {
      return Promise.resolve({
        status: 'escalate',
        phase: 'tool-input',
        riskScore: Math.min(highDetections.length * 0.2, 0.8),
        reason: `High-risk command detected: ${highDetections.map(d => d.id).join(', ')}`,
        detections: highDetections
      });
    }

    return Promise.resolve({ status: 'pass', phase: 'tool-input' });
  }
}
