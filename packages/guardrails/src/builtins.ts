import { CommandValidationScanner } from './command-validation.js';
import { PathSanitizationScanner } from './path-sanitization.js';
import { PIIScanner } from './pii.js';
import { PromptInjectionScanner } from './prompt-injection.js';
import { RateLimiterScanner } from './rate-limiter.js';
import { SecretDetectionScanner } from './secret-detection.js';
import { ToxicityScanner } from './toxicity.js';
import type { GuardrailScanner } from './types.js';

/**
 * Registry of all built-in guardrail scanners.
 *
 * @remarks
 * Returns an array of pre-configured scanner instances for all 7 built-in
 * guardrail types. Each scanner can be individually configured via constructor
 * options after registration.
 */
export function createBuiltinScanners(): GuardrailScanner[] {
  return [
    new PromptInjectionScanner(),
    new RateLimiterScanner(),
    new PathSanitizationScanner(),
    new CommandValidationScanner(),
    new PIIScanner(),
    new SecretDetectionScanner(),
    new ToxicityScanner()
  ];
}

export {
  CommandValidationScanner,
  PathSanitizationScanner,
  PIIScanner,
  PromptInjectionScanner,
  RateLimiterScanner,
  SecretDetectionScanner,
  ToxicityScanner
};

/**
 * Unique scanner IDs for all built-in guardrails.
 *
 * Useful for quickly checking which scanners are available without
 * instantiating them.
 */
export const BUILTIN_SCANNER_IDS: readonly string[] = [
  'hub://guardrails/prompt-injection',
  'hub://guardrails/rate-limiter',
  'hub://guardrails/path-sanitization',
  'hub://guardrails/command-validation',
  'hub://guardrails/pii',
  'hub://guardrails/secret-detection',
  'hub://guardrails/toxicity'
];
