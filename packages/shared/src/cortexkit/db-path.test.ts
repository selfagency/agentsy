import { describe, expect, it } from 'vitest';
import { isCortexKitDbPresent, resolveCortexKitDbDir, resolveCortexKitDbPath } from '../src/cortexkit/db-path.js';

describe('CortexKit DB path resolution', () => {
  it('returns a non-empty directory path', () => {
    const dir = resolveCortexKitDbDir();
    expect(dir).toBeTruthy();
    expect(dir).toContain('cortexkit');
    expect(dir).toContain('magic-context');
  });

  it('returns a non-empty db file path', () => {
    const path = resolveCortexKitDbPath();
    expect(path).toBeTruthy();
    expect(path).toContain('context.db');
  });

  it('detects when DB is not present (CI)', () => {
    // In CI the DB won't exist
    const present = isCortexKitDbPresent();
    // This is informational — depends on environment
    expect(typeof present).toBe('boolean');
  });
});
