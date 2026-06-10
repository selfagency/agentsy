import type { Detection, GuardrailResult, GuardrailScanner } from './types.js';

/**
 * Common prompt injection patterns.
 *
 * @internal
 */
const INJECTION_PATTERNS: { pattern: RegExp; id: string }[] = [
  // Role-play / system override attempts
  {
    pattern: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|above|prior)\s+instructions/i,
    id: 'system-override'
  },
  { pattern: /\byou\s+are\s+(?:now|free|not\s+(?:bound|limited|restricted))\b/i, id: 'role-play' },
  { pattern: /\b(?:new\s+(?:chat|session|conversation)|reset\s+context)\b/i, id: 'context-reset' },
  {
    pattern: /\bdo\s+not\s+(?:follow|obey|adhere\s+to)\s+(?:your\s+)?(?:instructions|rules|guidelines)\b/i,
    id: 'instruction-override'
  },

  // Delimiter confusion
  {
    pattern: /(?:```|<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\])\s*\n?.*\bignore\b/i,
    id: 'delimiter-injection'
  },

  // Token smuggling / hidden content
  {
    pattern: /\b(?:base64|rot13|hex|decod(?:e|ing))\s*(?:the\s+)?(?:following|below|this)\b/i,
    id: 'obfuscation-request'
  },

  // Direct instruction overriding
  {
    pattern: /\b(say|repeat|output|print|display|show)\s+(?:the\s+)?(?:word|text|phrase)\s+["']/i,
    id: 'direct-instruction'
  },
  {
    pattern: /\b(?:now\s+)?(?:respond|answer|reply)\s+(?:with|as|in)\s+(?:only|just|exactly)\b/i,
    id: 'constrained-output'
  },

  // Separator / delimiter injection attempts
  {
    pattern: /(?:---|===)\s*END\s*(?:---|===)\s*\n?\s*(?:now|ignore|print|repeat|output|system)\b/i,
    id: 'separator-injection'
  },

  // System prompt extraction requests
  {
    pattern:
      /\b(?:output|print|reveal|display|show)\s+(?:your|the)\s+(?:full\s+)?(?:system\s+)?(?:prompt|instructions?|directives?)\b/i,
    id: 'system-prompt-extraction'
  }
];

/**
 * Scanner that detects prompt injection attempts using pattern matching.
 *
 * @remarks
 * Uses regex-based detection against known prompt injection patterns.
 * This is a **fast, deterministic** scanner (priority: 10) that catches
 * common injection vectors. For higher-coverage detection, pair with
 * an ML-based scanner (not yet built).
 */
export class PromptInjectionScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/prompt-injection',
    name: 'Prompt Injection Scanner',
    version: '1.0.0',
    description: 'Detects prompt injection attempts using regex pattern matching',
    priority: 12,
    owaspCategories: ['asi-01'] as const,
    tags: ['injection', 'security', 'input-validation']
  };

  evaluate(input: string, _context?: Record<string, unknown>): Promise<GuardrailResult> {
    const detections: Detection[] = [];

    for (const { pattern, id } of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        detections.push({
          id,
          description: `Prompt injection attempt: ${id}`,
          severity: 'high'
        });
      }
    }

    if (detections.length === 0) {
      return Promise.resolve({ status: 'pass', phase: 'input' });
    }

    return Promise.resolve({
      status: 'block',
      phase: 'input',
      reason: `Prompt injection detected: ${detections.map(d => d.id).join(', ')}`,
      detections
    });
  }
}
