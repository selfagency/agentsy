/**
 * Shared utility helpers for normalizer functions.
 *
 * These are extracted to avoid repeating the same two-line type-guard
 * implementations across every provider normalizer file.
 */

/** Returns `true` when `v` is a non-null, non-array object. */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Returns `v` when it is a `number`, otherwise `undefined`. */
export function toNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
