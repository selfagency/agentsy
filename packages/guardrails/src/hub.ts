/**
 * Guardrail Hub — a local registry for guardrail packages,
 * resolved via `hub://` URIs.
 *
 * The hub allows guardrails to be installed from sources such as
 * npm packages, local paths, or a remote registry (future).
 * Each installed guardrail is a factory that produces a
 * `GuardrailScanner`.
 */

import type { GuardrailScanner } from './types.js';

// =============================================================================
// URI resolution
// =============================================================================

/**
 * Parse a hub URI into its components.
 *
 * Supported schemes:
 * - `hub://guardrails/<name>` — named hub guardrail (looked up by name)
 * - `npm://@scope/name` — npm package (future)
 * - `file:///path/to/module` — local path (future)
 */
export interface HubUri {
  readonly scheme: 'hub' | 'npm' | 'file';
  readonly full: string;
  readonly packageName: string;
  readonly version?: string;
}

const HUB_URI_PATTERN = /^(hub|npm|file):\/\/(.+)$/;
const VERSION_SPLIT = /@(\d+(?:\.\d+)?(?:\.\d+)?)$/;

export function parseHubUri(uri: string): HubUri | null {
  const match = HUB_URI_PATTERN.exec(uri);
  if (!match) return null;

  const scheme = match[1] as HubUri['scheme'];
  let rest = match[2] as string;

  // Extract version suffix
  const versionMatch = VERSION_SPLIT.exec(rest);
  const version = versionMatch?.[1];
  if (versionMatch) {
    rest = rest.slice(0, versionMatch.index);
  }

  return {
    scheme,
    full: uri,
    packageName: rest,
    ...(versionMatch ? { version: versionMatch[1]! } : {})
  };
}

// =============================================================================
// Guardrail factory — produces scanner instances from a hub entry
// =============================================================================

export type GuardrailFactory = () => GuardrailScanner | Promise<GuardrailScanner>;

export interface HubEntry {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly factory: GuardrailFactory;
  readonly installedAt?: Date;
}

// =============================================================================
// GuardrailHub — local registry backing `hub://` URIs
// =============================================================================

export class GuardrailHub {
  readonly #entries = new Map<string, HubEntry>();

  /**
   * Register a guardrail factory under a `hub://` URI.
   */
  install(uri: string, name: string, description: string, factory: GuardrailFactory): void {
    this.#entries.set(uri, {
      uri,
      name,
      description,
      factory,
      installedAt: new Date()
    });
  }

  /**
   * Remove a guardrail by its `hub://` URI.
   */
  uninstall(uri: string): boolean {
    return this.#entries.delete(uri);
  }

  /**
   * Resolve a `hub://` URI to a scanner instance.
   * Returns `null` if the guardrail is not installed.
   */
  async resolve(uri: string): Promise<GuardrailScanner | null> {
    const parsed = parseHubUri(uri);
    if (!parsed || parsed.scheme !== 'hub') return null;

    const entry = this.#entries.get(uri);
    if (!entry) return null;

    return entry.factory();
  }

  /**
   * Resolve multiple hub URIs concurrently.
   */
  async resolveAll(uris: string[]): Promise<(GuardrailScanner | null)[]> {
    return Promise.all(uris.map(u => this.resolve(u)));
  }

  /**
   * List all installed guardrails.
   */
  listInstalled(): HubEntry[] {
    return Array.from(this.#entries.values());
  }

  /**
   * Check if a guardrail is installed by its hub URI.
   */
  isInstalled(uri: string): boolean {
    return this.#entries.has(uri);
  }

  /**
   * Remove all installed guardrails.
   */
  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}

/**
 * Built-in hub URI constants shared across the codebase.
 */
export const BUILTIN_GUARDRAIL_URIS = {
  PROMPT_INJECTION: 'hub://guardrails/prompt_injection@1.0',
  PII: 'hub://guardrails/pii_detection@1.0',
  SECRET_DETECTION: 'hub://guardrails/secret_detection@1.0',
  OUTPUT_PII: 'hub://guardrails/output_pii_redaction@1.0',
  PATH_SANITIZATION: 'hub://guardrails/path_sanitization@1.0',
  COMMAND_VALIDATION: 'hub://guardrails/command_validation@1.0',
  TOXICITY: 'hub://guardrails/toxicity_filter@1.0',
  RATE_LIMITER: 'hub://guardrails/rate_limiter@1.0'
} as const;
