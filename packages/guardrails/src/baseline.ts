/**
 * Baseline suppression for guardrail findings.
 *
 * Inspired by entro-scan's baseline config and leak-hunter's `.leakhunterignore`.
 *
 * A baseline is a set of known-finding fingerprints that should be
 * suppressed from future scan results. This lets teams:
 * - Acknowledge existing findings without fixing them immediately
 * - Focus on NEW findings introduced by current work
 * - Audit baselines periodically to ensure they stay valid
 *
 * ## Baseline format
 *
 * Baselines are stored as YAML in `.agentsy/guardrails-baseline.yaml`:
 *
 * ```yaml
 * version: 1
 * generated_at: '2026-06-09T12:00:00Z'
 * entries:
 *   - fingerprint: abc123def456...
 *     detection_id: aws-access-key
 *     note: Known test key in test fixtures — not a real credential
 *     created_at: '2026-06-09T12:00:00Z'
 * ```
 *
 * Fingerprints are sha256 hashes of `detection_id + ":" + matched_value`.
 * This means baselines are auditable without storing plaintext secrets.
 */

import { createHash } from 'node:crypto';

import type { Detection } from './types.js';

// =============================================================================
// Baseline entry
// =============================================================================

export interface BaselineEntry {
  /** ISO timestamp when this entry was created. */
  readonly createdAt: string;
  /** The detector ID that produced this finding. */
  readonly detectionId: string;
  /** sha256 fingerprint of `detectionId + ":" + value`. */
  readonly fingerprint: string;
  /** Optional human note explaining why this finding is baseline'd. */
  readonly note?: string;
}

// =============================================================================
// Baseline document
// =============================================================================

export interface BaselineDocument {
  entries: BaselineEntry[];
  /** ISO timestamp when this baseline was generated. */
  readonly generatedAt: string;
  /** Schema version (currently 1). */
  readonly version: 1;
}

// =============================================================================
// Fingerprinting
// =============================================================================

/**
 * Create a sha256 fingerprint for a detection + value pair.
 *
 * The fingerprint is a hex-encoded sha256 of `detectionId + ":" + value`.
 * This means baselines never store plaintext secrets.
 */
export function fingerprint(detectionId: string, value: string): string {
  return createHash('sha256').update(`${detectionId}:${value}`).digest('hex');
}

// =============================================================================
// Baseline manager
// =============================================================================

export class BaselineManager {
  readonly #baseline: BaselineDocument;

  constructor(baseline?: BaselineDocument) {
    this.#baseline = baseline ?? {
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: []
    };
  }

  /**
   * Check if a detection is suppressed by the baseline.
   *
   * @param detection — The detection to check.
   * @param value — The matched value (used for fingerprinting).
   * @returns True if a matching baseline entry exists.
   */
  isSuppressed(detection: Detection, value: string): boolean {
    const fp = fingerprint(detection.id, value);
    return this.#baseline.entries.some(e => e.fingerprint === fp);
  }

  /**
   * Add a detection to the baseline.
   *
   * @param detection — The detection to add.
   * @param value — The matched value (used for fingerprinting).
   * @param note — Optional human-readable note.
   */
  add(detection: Detection, value: string, note?: string): void {
    const fp = fingerprint(detection.id, value);

    // Don't add duplicates
    if (this.#baseline.entries.some(e => e.fingerprint === fp)) {
      return;
    }

    this.#baseline.entries = [
      ...this.#baseline.entries,
      {
        fingerprint: fp,
        detectionId: detection.id,
        createdAt: new Date().toISOString(),
        ...(note === undefined ? {} : { note })
      }
    ];
  }

  /**
   * Remove a baseline entry by fingerprint.
   */
  remove(fingerprint: string): boolean {
    const before = this.#baseline.entries.length;
    this.#baseline.entries = this.#baseline.entries.filter(e => e.fingerprint !== fingerprint);
    return this.#baseline.entries.length < before;
  }

  /**
   * Filter detections, suppressing those in the baseline.
   *
   * @param detections — Array of `{ detection, value }` pairs.
   * @returns Only detections NOT suppressed by the baseline.
   */
  filter(detections: Array<{ detection: Detection; value: string }>): Array<{ detection: Detection; value: string }> {
    return detections.filter(({ detection, value }) => !this.isSuppressed(detection, value));
  }

  /**
   * Get a snapshot of the current baseline document.
   */
  snapshot(): BaselineDocument {
    return { ...this.#baseline, entries: [...this.#baseline.entries] };
  }

  /**
   * Number of entries in the baseline.
   */
  get size(): number {
    return this.#baseline.entries.length;
  }
}
