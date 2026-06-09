/* oxlint-disable xss/no-mixed-html -- test fixtures intentionally include literal secret patterns */
import { describe, expect, it } from 'vitest';

import { createSecretDetectionHook, detectSecrets, redactSecrets } from './index.js';

// ---------------------------------------------------------------------------
// detectSecrets
// ---------------------------------------------------------------------------

describe('detectSecrets', () => {
  it('detects AWS Access Keys (AKIA...)', () => {
    const text = 'Key: AKIAIOSFODNN7EXAMPLE';
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('AWS Access Key');
    expect(matches[0]?.value).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('detects GitHub personal access tokens (ghp_...)', () => {
    // nosemgrep: detected-github-token
    const text = 'Token: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('GitHub Token');
  });

  it('detects GitHub fine-grained PATs (github_pat_...)', () => {
    const text = `Token: github_pat_aaaa_bbbb_cccc_dddd_eeeeeeeeeeee_${'a'.repeat(59)}`;
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('GitHub Token');
  });

  it('detects Anthropic API keys (sk-ant-...)', () => {
    // 20-char key body (matches the 3-32 range pattern)
    const body = 'a'.repeat(20);
    const text = `Key: sk-ant-${body}`;
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('Anthropic Key');
  });

  it('detects shorter Anthropic API keys (sk-ant-... 3-32 chars)', () => {
    const text = 'Key: sk-ant-abcdef123456';
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('Anthropic Key');
  });

  it('detects OpenAI API keys (sk-... 48 chars)', () => {
    const body = 'a'.repeat(48);
    const text = `Key: sk-${body}`;
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('OpenAI Key');
  });

  it('detects OpenAI project API keys (sk-proj-...)', () => {
    const body = 'a'.repeat(60);
    const text = `Key: sk-proj-${body}`;
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe('OpenAI Key');
  });

  it('returns correct start/end positions', () => {
    const text = 'prefix AKIAIOSFODNN7EXAMPLE suffix';
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0]?.start, matches[0]?.end)).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('detects multiple secret types in one string', () => {
    // nosemgrep: detected-github-token
    const text = 'AWS: AKIAIOSFODNN7EXAMPLE\nGH: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const matches = detectSecrets(text);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for safe text', () => {
    const matches = detectSecrets('Hello world, this is safe text.');
    expect(matches).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    const matches = detectSecrets('');
    expect(matches).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

describe('redactSecrets', () => {
  it('redacts a single AWS key', () => {
    const { redacted, matches } = redactSecrets('Key: AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('[REDACTED:AWS Access Key]');
    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(matches).toHaveLength(1);
  });

  it('redacts an OpenAI key and preserves surrounding text', () => {
    const body = 'a'.repeat(48);
    const input = `api_key=sk-${body}`;
    const { redacted } = redactSecrets(input);
    expect(redacted).toBe('api_key=[REDACTED:OpenAI Key]');
  });

  it('returns original text when no secrets found', () => {
    const { redacted, matches } = redactSecrets('safe text');
    expect(redacted).toBe('safe text');
    expect(matches).toHaveLength(0);
  });

  it('redacts multiple secrets in one string', () => {
    // nosemgrep: detected-github-token
    const text = 'AWS: AKIAIOSFODNN7EXAMPLE\nGH: ghp_abcdefghijklmnopqrstuvwxyz0123456789abcd';
    const { redacted, matches } = redactSecrets(text);
    expect(redacted).toContain('[REDACTED:AWS Access Key]');
    expect(redacted).toContain('[REDACTED:GitHub Token]');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// createSecretDetectionHook
// ---------------------------------------------------------------------------

describe('createSecretDetectionHook', () => {
  const hook = createSecretDetectionHook();

  it('returns a HookHandler with id and priority', () => {
    expect(hook.id).toBe('security:secret-detection');
    expect(hook.priority).toBe(100);
  });

  it('returns continue: true when event result is not a string', async () => {
    const result = await hook.handler({
      type: 'PostToolCall',
      args: { cmd: 'ls' },
      result: { data: [1, 2, 3] },
      sessionId: 'sess_1',
      toolName: 'fs_read'
    });
    expect(result).toEqual({ continue: true });
  });

  it('returns continue: true when result contains no secrets', async () => {
    const result = await hook.handler({
      type: 'PostToolCall',
      args: { cmd: 'ls' },
      result: 'safe output',
      sessionId: 'sess_1',
      toolName: 'shell'
    });
    expect(result).toEqual({ continue: true });
  });

  it('returns transform with redacted result when secrets found', async () => {
    const result = await hook.handler({
      type: 'PostToolCall',
      args: { cmd: 'env' },
      result: 'AWS_KEY=AKIAIOSFODNN7EXAMPLE',
      sessionId: 'sess_1',
      toolName: 'shell'
    });
    expect(result).toHaveProperty('transform');
    const transformed = (result as { transform: string }).transform;
    expect(transformed).toContain('[REDACTED:AWS Access Key]');
    expect(transformed).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
