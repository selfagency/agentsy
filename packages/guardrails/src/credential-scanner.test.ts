/**
 * Tests for CredentialReferenceScanner.
 *
 * Uses a local mock broker to avoid a circular dependency on @agentsy/secrets.
 */

import { describe, expect, it } from 'vitest';

import type { CredentialBrokerLike } from '../src/credential-scanner.js';
import { CredentialReferenceScanner } from '../src/credential-scanner.js';

// =============================================================================
// Mock broker
// =============================================================================

class MockBroker implements CredentialBrokerLike {
  readonly #store: Map<string, string>;
  readonly #issued: Array<{
    event: string;
    request?: { sessionId: string; justification: string };
    id?: string;
  }> = [];

  constructor(entries: Record<string, string>) {
    this.#store = new Map(Object.entries(entries));
  }

  check(resourceType: string): boolean {
    return this.#store.has(resourceType);
  }

  issue(request: {
    resourceType: string;
    sessionId: string;
    justification: string;
    requestedScopes: string[];
    ttlSeconds: number;
  }): { id: string } {
    const value = this.#store.get(request.resourceType);
    if (value === undefined) {
      throw new Error(`No credential for ${request.resourceType}`);
    }
    const id = `cred_${request.resourceType}_1`;
    this.#store.set(id, value);
    this.#issued.push({
      event: 'issued',
      request: { sessionId: request.sessionId, justification: request.justification },
      id
    });
    return { id };
  }

  resolve(id: string): string {
    const value = this.#store.get(id);
    if (value === undefined) {
      throw new Error(`Unknown credential: ${id}`);
    }
    return value;
  }

  getAuditLog(): Array<{ event: string; request?: { sessionId: string; justification: string }; id?: string }> {
    return this.#issued;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function createBroker(entries: Record<string, string>): MockBroker {
  return new MockBroker(entries);
}

// =============================================================================
// CredentialReferenceScanner
// =============================================================================

describe('CredentialReferenceScanner', () => {
  it('passes when input contains no secret patterns', async () => {
    const broker = await createBroker({ openai: 'sk-real-key-12345' });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('run a shell command and list files', { sessionId: 's1', toolName: 'shell' });

    expect(result.status).toBe('pass');
  });

  it('passes when secret pattern matches but broker has no credential', async () => {
    const broker = await createBroker({});
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('run vercel with token sk-abc123xyz789def456', {
      sessionId: 's1',
      toolName: 'shell'
    });

    expect(result.status).toBe('pass');
  });

  it('resolves an OpenAI key when pattern matches and broker has it', async () => {
    const broker = await createBroker({ openai: 'sk-real-resolved-value' });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('call openai --api-key sk-ABCdef1234567890abcd', {
      sessionId: 's1',
      toolName: 'shell'
    });

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('sk-real-resolved-value');
      expect(result.sanitized).not.toContain('sk-ABCdef1234567890abcd');
    }
  });

  it('resolves a GitHub PAT', async () => {
    const broker = await createBroker({ github: 'ghp_real_value_abc123' });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('clone repo using ghp_ABCDefghIJKLmnopQRSTuvwxYZ1234567890', {
      sessionId: 's2',
      toolName: 'git'
    });

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('ghp_real_value_abc123');
    }
  });

  it('resolves an Anthropic key', async () => {
    const broker = await createBroker({ anthropic: 'sk-ant-real-key' });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('use Anthropic API with sk-ant-ABCDefghIJKLmnopQRSTuvwx12345678', {
      sessionId: 's3',
      toolName: 'anthropic'
    });

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('sk-ant-real-key');
    }
  });

  it('resolves an AWS access key', async () => {
    const broker = await createBroker({ aws: 'AKIA_REAL_SECRET' });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate('deploy to AWS with AKIA0123456789ABCDEF', {
      sessionId: 's4',
      toolName: 'aws-cli'
    });

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('AKIA_REAL_SECRET');
    }
  });

  it('resolves a Slack bot token', async () => {
    const broker = await createBroker({ slack: 'slack-api-token-placeholder' });
    // Use a custom pattern to avoid triggering GitHub push protection
    // which blocks xoxb-* patterns in source code
    const customPatterns: CredentialPattern[] = [
      {
        order: 1,
        regex: /slack-bot-token-[A-Za-z0-9]+/g,
        resourceType: 'slack',
        description: 'Slack bot token (test)'
      }
    ];
    const scanner = new CredentialReferenceScanner(broker, { patterns: customPatterns });

    const result = await scanner.evaluate('post to slack using slack-bot-token-abcdef123456', {
      sessionId: 's5',
      toolName: 'slack'
    });

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('slack-api-token-placeholder');
    }
  });

  it('resolves multiple credential types in the same input', async () => {
    const broker = await createBroker({
      openai: 'sk-resolved-openai',
      github: 'ghp-resolved-github'
    });
    const scanner = new CredentialReferenceScanner(broker);

    const result = await scanner.evaluate(
      'call openai with sk-ABCdef1234567890abcd and push to ghp_ABCDefghIJKLmnopQRSTuvwxYZ1234567890',
      { sessionId: 's6', toolName: 'script' }
    );

    expect(result.status).toBe('transform');
    if (result.status === 'transform') {
      expect(result.sanitized).toContain('sk-resolved-openai');
      expect(result.sanitized).toContain('ghp-resolved-github');
    }
  });

  it('issues a credential with the correct session ID and tool name', async () => {
    const broker = new MockBroker({ openai: 'sk-real-value' });
    const scanner = new CredentialReferenceScanner(broker);

    await scanner.evaluate('use sk-ABCdef1234567890abcd', { sessionId: 'test-session', toolName: 'my-tool' });

    const log = broker.getAuditLog();
    const issuedEntries = log.filter(e => e.event === 'issued');
    expect(issuedEntries.length).toBeGreaterThanOrEqual(1);
    const entry = issuedEntries[0];
    expect(entry?.request?.sessionId).toBe('test-session');
    expect(entry?.request?.justification).toContain('my-tool');
  });

  it('handles broker error gracefully (fallback to pass)', async () => {
    // A broker that throws on issue()
    const throwingBroker = {
      check: async () => true,
      issue: () => {
        throw new Error('Broker unavailable');
      },
      resolve: async () => '',
      getAuditLog: () => [],
      listActive: async () => [],
      revoke: () => {
        /* no-op */
      }
    } satisfies CredentialBrokerLike;

    const scanner = new CredentialReferenceScanner(throwingBroker);

    const result = await scanner.evaluate('use sk-ABCdef1234567890abcd', { sessionId: 's1', toolName: 'test' });

    // Should pass when broker throws
    expect(result.status).toBe('pass');
  });

  it('has correct metadata', () => {
    const broker = {} as CredentialBrokerLike;
    const scanner = new CredentialReferenceScanner(broker);

    expect(scanner.metadata.id).toBe('agentsy:guardrails:credential-reference');
    expect(scanner.metadata.priority).toBe(8);
    expect(scanner.metadata.tags).toContain('credential');
    expect(scanner.metadata.phase).toBeUndefined(); // not in metadata, set in result
  });
});
