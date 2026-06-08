import type { HelperPolicyDecision, HelperPolicyInput } from './types.js';

export function evaluateHelperPolicy(input: HelperPolicyInput): HelperPolicyDecision {
  if (input.enabled === false) {
    return { allowed: false, reason: 'helper disabled' };
  }

  const maxConcurrency = input.helper.maxConcurrency ?? 1;
  if ((input.activeCount ?? 0) >= maxConcurrency) {
    return { allowed: false, reason: 'max concurrency reached' };
  }

  return { allowed: true };
}
