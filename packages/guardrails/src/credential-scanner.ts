/**
 * CredentialReferenceScanner — resolves known credentials through
 * CredentialBroker instead of blocking them.
 *
 * Runs at priority 8 (before PII at 10, secret-detection at 12) so that
 * known credentials are resolved before other scanners detect and block
 * them. The resolved value is injected into tool execution only — the
 * tool-output guardrails redact secrets from results before the LLM sees
 * them.
 */

import type { GuardrailResult, GuardrailScanner } from './types.js';

// =============================================================================
// Broker interface (local — avoids circular dependency on @agentsy/secrets)
// =============================================================================

/**
 * Minimal interface for the CredentialBroker — only the methods the scanner
 * needs. The actual broker is injected via constructor at runtime, breaking
 * the build graph cycle: guardrails → secrets → runtime → guardrails.
 */
export interface CredentialBrokerLike {
  /** Check whether a credential exists for the given resource type. */
  check(resourceType: string): Promise<boolean>;
  /** Issue a new credential for the given resource type. */
  issue(request: {
    resourceType: string;
    sessionId: string;
    justification: string;
    requestedScopes: string[];
    ttlSeconds: number;
  }): Promise<{ id: string }>;
  /** Resolve a credential to its raw value by ID. */
  resolve(id: string): Promise<string>;
}

// =============================================================================
// Types
// =============================================================================

/**
 * A regex → resourceType mapping.
 *
 * When the pattern matches in tool arguments, the scanner looks up the
 * resource type in the CredentialBroker and replaces the matched text
 * with the resolved value.
 */
export interface CredentialPattern {
  /** Human-readable description for audit trail and metadata. */
  readonly description: string;
  /** Priority order (lower = higher priority) for matching. */
  readonly order: number;
  /** Regex to match the secret value in tool call arguments. */
  readonly regex: RegExp;
  /** Resource type to look up in the CredentialBroker. */
  readonly resourceType: string;
}

/** Options for CredentialReferenceScanner. */
export interface CredentialReferenceScannerOptions {
  /** Duration in seconds for issued credentials (default: 60). */
  readonly credentialTtlSeconds?: number;
  /** Optional override patterns (defaults to DEFAULT_CREDENTIAL_PATTERNS). */
  readonly patterns?: CredentialPattern[];
}

// =============================================================================
// Default patterns
// =============================================================================

const DEFAULT_CREDENTIAL_PATTERNS: CredentialPattern[] = [
  { order: 1, regex: /sk-proj-[A-Za-z0-9]{20,60}/g, resourceType: 'openai', description: 'OpenAI project API key' },
  {
    order: 2,
    regex: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,60}(?![A-Za-z0-9])/g,
    resourceType: 'openai',
    description: 'OpenAI API key'
  },
  { order: 3, regex: /sk-ant-[A-Za-z0-9]{20,60}/g, resourceType: 'anthropic', description: 'Anthropic API key' },
  { order: 4, regex: /AKIA[0-9A-Z]{16}/g, resourceType: 'aws', description: 'AWS access key ID' },
  { order: 5, regex: /ghp_[A-Za-z0-9]{36,40}/g, resourceType: 'github', description: 'GitHub classic PAT' },
  { order: 6, regex: /github_pat_[A-Za-z0-9_]{85,}/g, resourceType: 'github', description: 'GitHub fine-grained PAT' },
  { order: 7, regex: /gho_[A-Za-z0-9]{36,40}/g, resourceType: 'github', description: 'GitHub OAuth access token' },
  { order: 8, regex: /ghu_[A-Za-z0-9]{36,40}/g, resourceType: 'github', description: 'GitHub user-to-server token' },
  { order: 9, regex: /ghs_[A-Za-z0-9]{36,40}/g, resourceType: 'github', description: 'GitHub server-to-server token' },
  { order: 10, regex: /ghr_[A-Za-z0-9]{36,40}/g, resourceType: 'github', description: 'GitHub refresh token' },
  { order: 11, regex: /xoxb-[0-9A-Za-z-]{24,}/g, resourceType: 'slack', description: 'Slack bot token' },
  { order: 12, regex: /xoxp-[0-9A-Za-z-]{24,}/g, resourceType: 'slack', description: 'Slack user token' },
  { order: 13, regex: /xapp-[0-9A-Za-z-]{24,}/g, resourceType: 'slack', description: 'Slack app token' }
];

// =============================================================================
// Scanner
// =============================================================================

/**
 * Replace known credential patterns in the input with their resolved values.
 * Each pattern is applied in pattern order, matching by resource type against
 * the resolved value map.
 */
function replaceSecrets(input: string, patterns: CredentialPattern[], resolved: Map<string, string>): string {
  let result = input;
  for (const pattern of patterns) {
    const value = resolved.get(pattern.resourceType);
    if (value === undefined) {
      continue;
    }
    pattern.regex.lastIndex = 0;
    result = result.replace(pattern.regex, value);
  }
  return result;
}

/**
 * Guardrail scanner that resolves known credentials through the
 * CredentialBroker.
 *
 * When a secret pattern matches in tool arguments AND the broker has a
 * matching credential, the scanner issues + resolves the credential and
 * replaces the raw secret with the resolved value. This enables the
 * agent to use credentials without the LLM ever seeing the secret in
 * tool results.
 *
 * If the broker does NOT have a matchings credential, the scanner
 * returns `pass` — other scanners (PII, secret-detection) handle
 * enforcement.
 */
export class CredentialReferenceScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'agentsy:guardrails:credential-reference',
    name: 'Credential Reference Scanner',
    description: 'Resolves known credentials through the CredentialBroker instead of blocking them',
    priority: 8,
    tags: ['credential', 'secrets', 'resolution'],
    version: '0.1.0',
    owaspCategories: ['asi-07', 'asi-08'] as const
  };

  readonly #broker: CredentialBrokerLike;
  readonly #patterns: CredentialPattern[];
  readonly #credentialTtlSeconds: number;

  constructor(broker: CredentialBrokerLike, options?: CredentialReferenceScannerOptions) {
    this.#broker = broker;
    this.#patterns = options?.patterns ?? DEFAULT_CREDENTIAL_PATTERNS;
    this.#credentialTtlSeconds = options?.credentialTtlSeconds ?? 60;
  }

  /**
   * Collect which resource types are both matched by patterns AND available
   * in the broker. Queries the broker once per distinct resource type.
   */
  async #collectAvailable(input: string): Promise<Set<string>> {
    const sorted = [...this.#patterns].sort((a, b) => a.order - b.order);
    const applicable = sorted.filter(p => p.regex.test(input));
    if (applicable.length === 0) {
      return new Set();
    }
    const available = new Set<string>();
    for (const pattern of applicable) {
      if (!available.has(pattern.resourceType)) {
        const exists = await this.#broker.check(pattern.resourceType);
        if (exists) {
          available.add(pattern.resourceType);
        }
      }
    }
    return available;
  }

  /**
   * Issue + resolve credentials for the given set of resource types.
   * Returns a map of resourceType → resolved value, or empty on error.
   */
  async #resolveCredentials(
    resourceTypes: Set<string>,
    sessionId: string,
    toolName: string
  ): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    for (const resourceType of resourceTypes) {
      try {
        const request = {
          resourceType,
          sessionId,
          justification: `CredentialReferenceScanner: resolved ${resourceType} for tool "${toolName}"`,
          requestedScopes: ['*'],
          ttlSeconds: this.#credentialTtlSeconds
        };
        const credential = await this.#broker.issue(request);
        const value = await this.#broker.resolve(credential.id);
        resolved.set(resourceType, value);
      } catch {
        // Broker threw (expired, missing) — skip
      }
    }
    return resolved;
  }

  async evaluate(input: string, context?: Record<string, unknown>): Promise<GuardrailResult> {
    const sessionId = (context?.sessionId as string) ?? 'unknown';
    const toolName = (context?.toolName as string) ?? 'unknown';

    // Collect which credential types are available
    const available = await this.#collectAvailable(input);
    if (available.size === 0) {
      return { status: 'pass', phase: 'tool-input' };
    }

    // Issue + resolve credentials
    const resolved = await this.#resolveCredentials(available, sessionId, toolName);
    if (resolved.size === 0) {
      return { status: 'pass', phase: 'tool-input' };
    }

    // Replace raw secrets with resolved values in the input
    const result = replaceSecrets(input, this.#patterns, resolved);

    return {
      status: 'transform',
      phase: 'tool-input',
      sanitized: result
    };
  }
}
