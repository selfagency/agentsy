// fallow-ignore-file unused-file
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const { main } = await import('./validate-workspace.ts');

describe('validate-workspace', () => {
  it('should pass validation when all directories have package.json', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    mkdirSync(join(packagesDir, 'package1'));
    writeFileSync(join(packagesDir, 'package1', 'package.json'), '{}');
    mkdirSync(join(packagesDir, 'package2'));
    writeFileSync(join(packagesDir, 'package2', 'package.json'), '{}');

    await main(packagesDir);

    expect(process.exitCode).toBe(0);

    rmSync(base, { recursive: true, force: true });
  });

  it('should fail validation when directory lacks package.json', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    mkdirSync(join(packagesDir, 'valid-package'));
    writeFileSync(join(packagesDir, 'valid-package', 'package.json'), '{}');
    mkdirSync(join(packagesDir, 'invalid-package'));

    await main(packagesDir);

    expect(process.exitCode).toBe(1);

    rmSync(base, { recursive: true, force: true });
  });

  it('should skip dot directories starting with .', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    mkdirSync(join(packagesDir, '.git'));
    mkdirSync(join(packagesDir, 'package1'));
    writeFileSync(join(packagesDir, 'package1', 'package.json'), '{}');

    await main(packagesDir);

    expect(process.exitCode).toBe(0);

    rmSync(base, { recursive: true, force: true });
  });

  it('should respect IGNORE_DIRS allowlist', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    mkdirSync(join(packagesDir, 'core'));
    mkdirSync(join(packagesDir, 'package1'));
    writeFileSync(join(packagesDir, 'package1', 'package.json'), '{}');

    // call main with packagesDir; current IGNORE_DIRS is empty but test ensures core won't break
    await main(packagesDir);

    expect(process.exitCode).toBe(0);

    rmSync(base, { recursive: true, force: true });
  });

  it('should continue if non-packages and allowed dirs both present', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    mkdirSync(join(packagesDir, 'valid-package'));
    writeFileSync(join(packagesDir, 'valid-package', 'package.json'), '{}');
    mkdirSync(join(packagesDir, 'invalid-package'));
    mkdirSync(join(packagesDir, 'core'));

    await main(packagesDir);

    expect(process.exitCode).toBe(1);

    rmSync(base, { recursive: true, force: true });
  });

  it('should handle missing packages/ directory gracefully', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'no-packages-here');

    await main(packagesDir);

    expect(process.exitCode).toBe(0);

    rmSync(base, { recursive: true, force: true });
  });

  it('should handle errors during directory reading', async () => {
    const base = mkdtempSync(join(tmpdir(), 'agentsy-validate-'));
    const packagesDir = join(base, 'packages');
    mkdirSync(packagesDir);

    // Remove read permissions so readdir will throw a permission error
    const { chmodSync } = await import('node:fs');
    chmodSync(packagesDir, 0o000);

    await main(packagesDir);

    // main should set exitCode to 1 on errors
    expect(process.exitCode).toBe(1);

    // restore permissions so cleanup can remove the temp directory
    chmodSync(packagesDir, 0o700);
    rmSync(base, { recursive: true, force: true });
  });
});
