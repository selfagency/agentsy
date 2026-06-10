import { beforeEach, describe, expect, it } from 'vitest';
import { RateLimiterScanner } from './rate-limiter.js';

describe('RateLimiterScanner', () => {
  const scanner = new RateLimiterScanner({ maxRequests: 5, windowMs: 10_000 });

  beforeEach(() => {
    scanner.reset();
  });

  it('passes within limit', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await scanner.evaluate('safe request', { toolName: 'fs_read' });
      expect(r.status).toBe('pass');
    }
  });

  it('blocks after limit exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      await scanner.evaluate('req', { toolName: 'fs_read' });
    }
    const r = await scanner.evaluate('req', { toolName: 'fs_read' });
    expect(r.status).toBe('block');
    if (r.status === 'block') {
      expect(r.reason).toContain('Rate limit exceeded');
    }
  });

  it('resets correctly', async () => {
    for (let i = 0; i < 6; i++) {
      await scanner.evaluate('req', { toolName: 'fs_read' });
    }
    await (scanner as { reset: () => void }).reset();
    const r = await scanner.evaluate('req', { toolName: 'fs_read' });
    expect(r.status).toBe('pass');
  });

  it('differentiates by toolName', async () => {
    for (let i = 0; i < 10; i++) {
      await scanner.evaluate('req', { toolName: 'fs_read' });
    }
    const r = await scanner.evaluate('req', { toolName: 'shell_exec' });
    expect(r.status).toBe('pass');
  });

  it('tracks remaining allowances', async () => {
    await scanner.evaluate('req', { toolName: 'test_tool' });
    await scanner.evaluate('req', { toolName: 'test_tool' });
    const r = await scanner.evaluate('req', { toolName: 'test_tool' });
    expect(r.status).toBe('pass');
  });

  it('has correct metadata', () => {
    const meta = scanner.metadata;
    expect(meta.id).toBe('hub://guardrails/rate-limiter');
    expect(meta.owaspCategories).toContain('asi-03');
  });
});
