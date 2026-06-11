/**
 * CredentialBroker — short-lived, audited credential issuance.
 *
 * Issues task-scoped credentials with default 5-minute TTL, maintains an
 * audit log, and supports revocation and session-scoped listing.
 */

import type { AuditEntry, CredentialRequest, IssuedCredential } from './types.js';
import { MissingCredentialError } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
const nextId = (): string => {
  _idCounter++;
  return `cred_${Date.now()}_${_idCounter}`;
};

/** Placeholder encryption — base64-encodes the value.
 *  Production should use AES-GCM with a managed key. */
function encrypt(value: string): string {
  return Buffer.from(value).toString('base64');
}

/** Placeholder decryption. */
function decrypt(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// ---------------------------------------------------------------------------
// Keyring — minimal in-memory secret store
// ---------------------------------------------------------------------------

/** Storage interface the broker uses to look up raw secrets. */
export interface Keyring {
  get(resourceType: string): Promise<string | undefined>;
}

/** In-memory keyring for testing / single-process use. */
export class InMemoryKeyring implements Keyring {
  private readonly store = new Map<string, string>();

  set(resourceType: string, value: string): void {
    this.store.set(resourceType, value);
  }

  get(resourceType: string): Promise<string | undefined> {
    return Promise.resolve(this.store.get(resourceType));
  }
}

// ---------------------------------------------------------------------------
// Broker
// ---------------------------------------------------------------------------

export interface CredentialBrokerOptions {
  /** Default TTL in seconds (default: 300 / 5 min). */
  defaultTtlSeconds?: number;
  /** Keyring implementation to resolve raw secrets. */
  keyring: Keyring;
}

export class CredentialBroker {
  private readonly keyring: Keyring;
  private readonly defaultTtlSeconds: number;
  private readonly credentials = new Map<string, IssuedCredential>();
  private readonly auditLog: AuditEntry[] = [];

  constructor(options: CredentialBrokerOptions) {
    this.keyring = options.keyring;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
  }

  /**
   * Check whether a credential is available for the given resource type,
   * without issuing or auditing.
   */
  async check(resourceType: string): Promise<boolean> {
    const rawValue = await this.keyring.get(resourceType);
    return rawValue !== undefined;
  }

  /** Issue a credential for the given request.
   *  Throws MissingCredentialError if no secret is available for the resource type. */
  async issue(request: CredentialRequest): Promise<IssuedCredential> {
    const rawValue = await this.keyring.get(request.resourceType);
    if (!rawValue) {
      throw new MissingCredentialError(request.resourceType);
    }

    const id = nextId();
    const ttl = request.ttlSeconds ?? this.defaultTtlSeconds;
    const encrypted = encrypt(rawValue);
    const credential: IssuedCredential = {
      id,
      encrypted,
      expiresAt: new Date(Date.now() + ttl * 1000),
      scopes: [...request.requestedScopes],
      meta: {
        resourceType: request.resourceType,
        toolCallId: request.toolCallId,
        sessionId: request.sessionId,
        justification: request.justification
      }
    };

    this.credentials.set(id, credential);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      event: 'issued',
      credentialId: id,
      request,
      sessionId: request.sessionId
    });

    return credential;
  }

  /** Decrypt and return the raw secret value for a credential.
   *  Throws if the credential does not exist or has expired. */
  resolve(credentialId: string): Promise<string> {
    const cred = this.credentials.get(credentialId);
    if (!cred) {
      return Promise.reject(new Error(`Credential ${credentialId} not found`));
    }
    if (cred.expiresAt < new Date()) {
      return Promise.reject(new Error(`Credential ${credentialId} has expired`));
    }
    return Promise.resolve(decrypt(cred.encrypted));
  }

  /** Revoke a credential (logs to audit trail). */
  revoke(credentialId: string): Promise<void> {
    const cred = this.credentials.get(credentialId);
    if (cred) {
      // Force expiration
      cred.expiresAt = new Date(0);
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      event: 'revoked',
      credentialId
    });
    return Promise.resolve();
  }

  /** Return all active (non-expired) credentials scoped to a session. */
  listActive(sessionId: string): Promise<IssuedCredential[]> {
    const now = new Date();
    const active: IssuedCredential[] = [];
    for (const cred of this.credentials.values()) {
      if (cred.meta.sessionId === sessionId && cred.expiresAt > now) {
        active.push(cred);
      }
    }
    return Promise.resolve(active);
  }

  /** Return a copy of the full audit trail (for inspection / testing). */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}

export type { AuditEntry, CredentialRequest, IssuedCredential, ResourceType } from './types.js';
export { MissingCredentialError } from './types.js';
