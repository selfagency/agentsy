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
  readonly full: string;
  readonly packageName: string;
  readonly scheme: 'hub' | 'npm' | 'file';
  readonly version?: string;
}

const HUB_URI_PATTERN = /^(hub|npm|file):\/\/(.+)$/;
const VERSION_SPLIT = /@(\d+(?:\.\d+)?(?:\.\d+)?)$/;

export function parseHubUri(uri: string): HubUri | null {
  const match = HUB_URI_PATTERN.exec(uri);
  if (!match) {
    return null;
  }

  const scheme = match[1] as 'hub' | 'npm' | 'file';
  let rest = match[2] ?? '';

  // Extract version suffix
  const versionMatch = VERSION_SPLIT.exec(rest);
  const _version = versionMatch?.[1];
  if (versionMatch) {
    rest = rest.slice(0, versionMatch.index);
  }

  return {
    scheme,
    full: uri,
    packageName: rest,
    ...(versionMatch?.[1] ? { version: versionMatch[1] } : {})
  };
}

// =============================================================================
// Guardrail factory — produces scanner instances from a hub entry
// =============================================================================

export type GuardrailFactory = () => GuardrailScanner | Promise<GuardrailScanner>;

export interface HubEntry {
  readonly description: string;
  readonly factory: GuardrailFactory;
  readonly installedAt?: Date;
  readonly name: string;
  readonly uri: string;
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
    if (parsed?.scheme !== 'hub') {
      return null;
    }

    const entry = this.#entries.get(uri);
    if (!entry) {
      return null;
    }

    return await entry.factory();
  }

  /**
   * Resolve multiple hub URIs concurrently.
   */
  resolveAll(uris: string[]): Promise<(GuardrailScanner | null)[]> {
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
/**
 * Built-in guardrail URIs keyed by scanner metadata.id with @version suffix.
 *
 * Each URI matches a scanner's `metadata.id` field plus a semver suffix.
 * For example, the prompt-injection scanner has `id: hub://guardrails/prompt-injection`
 * and version 1.0.0, so the builtin URI is `hub://guardrails/prompt-injection@1.0`.
 */
export const BUILTIN_GUARDRAIL_URIS = {
  PROMPT_INJECTION: 'hub://guardrails/prompt-injection@1.0',
  PII: 'hub://guardrails/pii@2.0',
  SECRET_DETECTION: 'hub://guardrails/secret-detection@2.0',
  PATH_SANITIZATION: 'hub://guardrails/path-sanitization@1.0',
  COMMAND_VALIDATION: 'hub://guardrails/command-validation@1.0',
  TOXICITY: 'hub://guardrails/toxicity@1.0',
  RATE_LIMITER: 'hub://guardrails/rate-limiter@1.0'
} as const;
