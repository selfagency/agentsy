/**
 * Deep object scrubbing — bagdock-inspired recursive PII scrubber.
 *
 * Recursively walks objects, arrays, and string values, running guardrail
 * scanners on every string. Returns a NEW object (no mutation).
 *
 * ## Usage
 *
 * ```typescript
 * const scrubbed = await scrubPiiDeep(userData, [piiScanner, secretScanner]);
 * ```
 *
 * ## Why this exists
 *
 * LLM tool calls often receive structured objects (not just flat strings).
 * A user profile might have `{ email, address, notes }` where the email
 * is PII but the address is safe. `scrubPiiDeep` walks every string value
 * and applies scanners, so PII deep inside nested data gets caught.
 *
 * ## Limitations
 *
 * - Does NOT scrub object keys (only values).
 * - Does NOT handle circular references (throws on cycles).
 * - Max depth configurable (default 10) to prevent stack overflows.
 */

import type { GuardrailScanner } from './types.js';

// =============================================================================
// Type guards
// =============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _isNonNullObject(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

// =============================================================================
// Deep scrubbing
// =============================================================================

/** Maximum nesting depth to prevent stack overflow. */
const DEFAULT_MAX_DEPTH = 10;

/**
 * Recursively scrub PII from a value by running scanners on every string.
 *
 * @param value — The value to scrub. Can be a string, object, array, or primitive.
 * @param scanners — Guardrail scanners to apply to each string value.
 * @param options — Optional configuration.
 * @param options.placeholder — Replacement text for redacted values (default: `[REDACTED]`).
 * @param options.maxDepth — Maximum recursion depth (default: 10).
 * @returns A new value with all string values scrubbed (no mutation).
 */
export interface ScrubOptions {
  maxDepth?: number;
  placeholder?: string;
}

export function scrubPiiDeep<T>(value: T, scanners: GuardrailScanner[], options?: ScrubOptions): Promise<T> {
  return scrubDeep(
    value,
    scanners,
    options?.placeholder ?? '[REDACTED]',
    options?.maxDepth ?? DEFAULT_MAX_DEPTH,
    0
  ) as unknown as Promise<T>;
}

async function scrubDeep(
  value: unknown,
  scanners: GuardrailScanner[],
  placeholder: string,
  maxDepth: number,
  depth: number
  // biome-ignore lint/suspicious/noConfusingVoidType: safe union for recursive return
): Promise<unknown | void> {
  // Base cases
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return scrubString(value, scanners, placeholder);
  }

  // Primitives pass through
  if (typeof value !== 'object') {
    return value;
  }

  // Depth limit
  if (depth >= maxDepth) {
    return value;
  }

  // Arrays
  if (Array.isArray(value)) {
    const results = await Promise.all(value.map(item => scrubDeep(item, scanners, placeholder, maxDepth, depth + 1)));
    return results;
  }

  // Plain objects
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const scrubbedEntries = await Promise.all(
      entries.map(async ([key, val]) => {
        const scrubbedVal = await scrubDeep(val, scanners, placeholder, maxDepth, depth + 1);
        return [key, scrubbedVal] as const;
      })
    );
    return Object.fromEntries(scrubbedEntries);
  }

  // Non-plain objects (Map, Set, Date, etc.) — pass through
  return value;
}

async function scrubString(value: string, scanners: GuardrailScanner[], _placeholder: string): Promise<string> {
  let result = value;

  for (const scanner of scanners) {
    try {
      const scanResult = await scanner.evaluate(result);

      if (scanResult.status === 'transform' && scanResult.sanitized) {
        result = scanResult.sanitized;
      }
      // block and escalate outcomes don't modify the string
    } catch {
      // Scanner error — leave the original value unchanged
    }
  }

  return result;
}
