/* oxlint-disable xss/no-mixed-html -- test fixtures intentionally include literal secret patterns */
import { describe, expect, it } from 'vitest';

import { type AuditEntry, CredentialBroker, InMemoryKeyring } from './index.js';
import { MissingCredentialError } from './types.js';

describe('InMemoryKeyring', () => {
  it('stores and retrieves values', async () => {
    const kr = new InMemoryKeyring();
    kr.set('github', 'ghp_fake_token');
    await expect(kr.get('github')).resolves.toBe('ghp_fake_token');
  });

  it('returns undefined for missing keys', async () => {
    const kr = new InMemoryKeyring();
    await expect(kr.get('nonexistent')).resolves.toBeUndefined();
  });
});

describe('CredentialBroker', () => {
  const buildBroker = () => {
    const keyring = new InMemoryKeyring();
    keyring.set('github', 'ghp_secret_42');
    keyring.set('openai', 'sk-secret-key');
    const broker = new CredentialBroker({ keyring, defaultTtlSeconds: 300 });
    return { broker, keyring };
  };

  const buildRequest = (overrides: Record<string, unknown> = {}) => ({
    toolCallId: 'tc_001',
    sessionId: 'sess_abc',
    resourceType: 'github' as const,
    requestedScopes: ['repo'],
    justification: 'Need to push branch',
    ...overrides
  });

  describe('issue()', () => {
    it('issues a credential with default 5-minute TTL', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest());

      expect(cred.id).toBeTruthy();
      expect(cred.scopes).toEqual(['repo']);
      expect(cred.encrypted).toBeTruthy();
      // Default TTL = 300s => within ~5s tolerance
      const expectedExpiry = Date.now() + 300_000;
      expect(cred.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
      expect(cred.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('honours custom ttlSeconds', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest({ ttlSeconds: 60 }));
      const expectedExpiry = Date.now() + 60_000;
      expect(cred.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 2000);
      expect(cred.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('throws MissingCredentialError when keyring has no secret', async () => {
      const { broker } = buildBroker();
      await expect(broker.issue(buildRequest({ resourceType: 'aws' }))).rejects.toThrow(MissingCredentialError);
    });

    it('records an audit entry on issue', async () => {
      const { broker } = buildBroker();
      await broker.issue(buildRequest());
      const log = broker.getAuditLog();
      expect(log).toHaveLength(1);
      const entry = log[0] as AuditEntry;
      expect(entry.event).toBe('issued');
    });
  });

  describe('resolve()', () => {
    it('decrypts and returns the raw secret', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest());
      const raw = await broker.resolve(cred.id);
      expect(raw).toBe('ghp_secret_42');
    });

    it('throws for unknown credential id', async () => {
      const { broker } = buildBroker();
      await expect(broker.resolve('cred_nonexistent')).rejects.toThrow('not found');
    });

    it('throws for expired credential', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest({ ttlSeconds: -1 }));
      // Force-expire by waiting a tick
      await expect(broker.resolve(cred.id)).rejects.toThrow('has expired');
    });
  });

  describe('revoke()', () => {
    it('revokes a credential and records audit entry', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest());
      await broker.revoke(cred.id);

      // Now expired
      await expect(broker.resolve(cred.id)).rejects.toThrow('has expired');
      const log = broker.getAuditLog();
      expect(log).toHaveLength(2);
      const revokeEntry = log[1] as AuditEntry;
      expect(revokeEntry.event).toBe('revoked');
    });
  });

  describe('listActive()', () => {
    it('returns only non-expired, session-scoped credentials', async () => {
      const { broker } = buildBroker();
      const req = buildRequest();
      const credA = await broker.issue(req);
      const credB = await broker.issue({ ...req, toolCallId: 'tc_002' });

      const active = await broker.listActive('sess_abc');
      expect(active).toHaveLength(2);
      expect(active.map(c => c.id)).toContain(credA.id);
      expect(active.map(c => c.id)).toContain(credB.id);
    });

    it('excludes expired credentials', async () => {
      const { broker } = buildBroker();
      const cred = await broker.issue(buildRequest({ ttlSeconds: -1 }));
      const active = await broker.listActive('sess_abc');
      expect(active.find(c => c.id === cred.id)).toBeUndefined();
    });

    it('excludes credentials from other sessions', async () => {
      const { broker } = buildBroker();
      await broker.issue(buildRequest({ sessionId: 'sess_other' }));
      const active = await broker.listActive('sess_unknown');
      expect(active).toHaveLength(0);
    });
  });
});
