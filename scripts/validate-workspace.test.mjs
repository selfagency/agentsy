import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../validate-workspace.mjs';

// Mock the fs modules
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  };
});

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    constants: actual.constants,
  };
});

vi.mock('node:path', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    join: (...args) => args.join('/'),
  };
});

describe('validate-workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
  });

  afterEach(() => {
    // Note: console mocks are automatically restored by vitest
  });

  it('should pass validation when all directories have package.json', async () => {
    const { readdir, access } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock successful scenario
    readdir.mockResolvedValue([
      { name: 'package1', isDirectory: () => true },
      { name: 'package2', isDirectory: () => true },
    ]);
    access.mockResolvedValue(undefined);
    stat.mockResolvedValue({ isDirectory: () => true });

    await main();

    expect(process.exitCode).toBe(0);
  });

  it('should fail validation when directory lacks package.json', async () => {
    const { readdir, access } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock failure scenario
    readdir.mockResolvedValue([
      { name: 'valid-package', isDirectory: () => true },
      { name: 'invalid-package', isDirectory: () => true },
    ]);
    access
      .mockResolvedValueOnce(undefined) // valid-package_json exists
      .mockRejectedValueOnce(new Error('File not found')); // invalid-package.json missing
    stat.mockResolvedValue({ isDirectory: () => true });

    await main();

    expect(process.exitCode).toBe(1);
  });

  it('should skip dot directories starting with .', async () => {
    const { readdir } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock scenario with dot directories
    readdir.mockResolvedValue([
      { name: '.git', isDirectory: () => true },
      { name: 'package1', isDirectory: () => true },
    ]);
    // access should only be called for package1
    const { access } = await import('node:fs/promises');
    access.mockResolvedValue(undefined);
    stat.mockResolvedValue({ isDirectory: () => true });

    await main();

    expect(process.exitCode).toBe(0);
  });

  it('should respect IGNORE_DIRS allowlist', async () => {
    const { readdir, access } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock scenario with 'core' directory
    readdir.mockResolvedValue([
      { name: 'core', isDirectory: () => true },
      { name: 'package1', isDirectory: () => true },
    ]);
    // access should only be called for package1, not core
    access.mockResolvedValue(undefined);
    stat.mockResolvedValue({ isDirectory: () => true });

    await main();

    expect(process.exitCode).toBe(0);
  });

  it('should continue if non-packages and allowed dirs both present', async () => {
    const { readdir, access } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock mixed scenario
    readdir.mockResolvedValue([
      { name: 'valid-package', isDirectory: () => true },
      { name: 'invalid-package', isDirectory: () => true },
      { name: 'core', isDirectory: () => true },
    ]);
    access
      .mockResolvedValueOnce(undefined) // valid-package.json exists
      .mockRejectedValue(new Error('File not found')); // invalid-package.json missing
    stat.mockResolvedValue({ isDirectory: () => true });

    await main();

    expect(process.exitCode).toBe(1);
  });

  it('should handle missing packages/ directory gracefully', async () => {
    const { stat } = await import('node:fs/promises');

    // Mock missing packages directory
    stat.mockRejectedValue(new Error('Directory not found'));

    await main();

    expect(process.exitCode).toBe(0);
  });

  it('should handle errors during directory reading', async () => {
    const { readdir } = await import('node:fs/promises');
    const { stat } = await import('node:fs');

    // Mock error during readdir
    stat.mockResolvedValue({ isDirectory: () => true });
    readdir.mockRejectedValue(new Error('Permission denied'));

    await main();

    expect(process.exitCode).toBe(1);
  });
});
