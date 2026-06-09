/**
 * Types for the CredentialBroker subsystem.
 *
 * Credentials are short-lived, task-scoped, encrypted, and audited.
 */

/** Discriminated union of supported resource types. */
export type ResourceType = 'github' | 'aws' | 'openai' | 'anthropic' | 'custom';

/** A request to issue a credential for a specific tool call. */
export interface CredentialRequest {
  /** Human-readable justification logged in the audit trail. */
  justification: string;
  /** Scopes the credential should grant (e.g. ['repo', 'admin:org']). */
  requestedScopes: string[];
  /** Which service the credential targets. */
  resourceType: ResourceType;
  /** Session that owns the tool call. */
  sessionId: string;
  /** ID of the tool call requesting the credential. */
  toolCallId: string;
  /** TTL override in seconds (defaults to 300 / 5 min). */
  ttlSeconds?: number;
}

/** A credential that has been issued and encrypted. */
export interface IssuedCredential {
  /** AES-GCM encrypted value (base64-encoded ciphertext). */
  encrypted: string;
  /** Expiration timestamp. */
  expiresAt: Date;
  /** Unique credential identifier (UUID). */
  id: string;
  /** Arbitrary metadata (e.g. resourceType, toolCallId). */
  meta: Record<string, unknown>;
  /** Granted scopes (mirrors the request). */
  scopes: string[];
}

/** Thrown when the requested resource type has no stored secret. */
export class MissingCredentialError extends Error {
  public override readonly name = 'MissingCredentialError';

  constructor(resourceType: string) {
    super(`No credential available for resource type "${resourceType}"`);
  }
}

/** Audit log entry for credential lifecycle events. */
export interface AuditEntry {
  /** Credential ID involved. */
  credentialId: string;
  /** Event type discriminator. */
  event: 'issued' | 'revoked' | 'expired';
  /** Optional request details (only present for 'issued'). */
  request?: CredentialRequest;
  /** Optional session-scoping hint (populated for issued / listActive). */
  sessionId?: string;
  /** ISO-8601 timestamp of the event. */
  timestamp: string;
}
