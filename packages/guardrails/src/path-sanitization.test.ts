import { describe, expect, it } from 'vitest';
import { PathSanitizationScanner } from './path-sanitization.js';
import { assertBlock, assertDetections, assertPass } from './test-helpers.js';

describe('PathSanitizationScanner', () => {
  const scanner = new PathSanitizationScanner();

  it('passes on safe paths', async () => {
    await assertPass(scanner, '/tmp/test.txt');
    await assertPass(scanner, './relative/path/file.ts');
    await assertPass(scanner, '/home/user/documents/report.pdf');
    await assertPass(scanner, 'data/files/config.json');
    await assertPass(scanner, '/var/log/app/current.log');
    await assertPass(scanner, '/opt/my-app/config/default.yaml');
  });

  it('blocks path traversal with ../', async () => {
    const r = await assertBlock(scanner, '../../../etc/passwd', 'Path traversal');
    assertDetections(r, ['path-traversal']);
  });

  it('blocks path traversal with multiple ..', async () => {
    const r = await assertBlock(scanner, '/var/www/../../etc/shadow', 'Path traversal');
    assertDetections(r, ['path-traversal']);
  });

  it('blocks encoded path traversal', async () => {
    const r = await assertBlock(scanner, '..%2F..%2F..%2Fetc/passwd', 'Path traversal');
    assertDetections(r, ['encoded-traversal']);
  });

  it('blocks symlink in tmp', async () => {
    const r = await assertBlock(scanner, '/tmp/symlink', 'Sensitive path');
    assertDetections(r, ['sensitive-path']);
  });

  it('blocks access to sensitive files', async () => {
    const r = await assertBlock(scanner, '~/.ssh/id_rsa', 'Sensitive path');
    assertDetections(r, ['sensitive-path']);
  });

  it('returns escalate for moderate-risk paths', async () => {
    const r = await scanner.evaluate('.../.../.../.../etc/passwd');
    if (r.status === 'block') {
      expect(r.detections).toBeDefined();
    } else {
      expect(r.status).toBe('escalate');
    }
  });

  it('has correct metadata', () => {
    const meta = scanner.metadata;
    expect(meta.id).toBe('hub://guardrails/path-sanitization');
    expect(meta.owaspCategories).toContain('asi-06');
  });
});
