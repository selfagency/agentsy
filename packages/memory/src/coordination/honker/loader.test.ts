import { join } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { HonkerLoadOptions } from './loader.js';
import { loadHonkerExtension } from './loader.js';

const SAFE_TEST_ROOT = join(process.cwd(), '.agentsy-test-artifacts');
const SAFE_DB_PATH = join(SAFE_TEST_ROOT, 'test.db');
const SAFE_ALT_DB_PATH = join(SAFE_TEST_ROOT, 'db.db');
const SAFE_UNICODE_HONKER_PATH = join(SAFE_TEST_ROOT, '扩展', 'honker.so');
const SAFE_UNICODE_BLAKE3_PATH = join(SAFE_TEST_ROOT, '扩展', 'blake3.so');

describe('HonkerExtensionLoader', () => {
  describe('loadHonkerExtension', () => {
    it('should return result with detected mode', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toHaveProperty('mode');
      expect(['native', 'fallback']).toContain(result.mode);
    });

    it('should include dbPath in result', async () => {
      const dbPath = '/custom/db/path.db';
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.dbPath).toBe(dbPath);
    });

    it('should include features in result', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toHaveProperty('features');
      expect(result.features).toHaveProperty('pubSub');
      expect(result.features).toHaveProperty('taskQueue');
      expect(result.features).toHaveProperty('scheduler');
      expect(result.features).toHaveProperty('blake3');

      expectTypeOf(result.features.pubSub).toBeBoolean();
      expectTypeOf(result.features.taskQueue).toBeBoolean();
      expectTypeOf(result.features.scheduler).toBeBoolean();
      expectTypeOf(result.features.blake3).toBeBoolean();
    });

    it('should return fallback mode when extensions do not exist', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/definitely/does/not/exist.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/definitely/does/not/exist.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.mode).toBe('fallback');
    });

    it('should have reason field when in fallback mode', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);
      expect(result.mode).toBe('fallback');
      expect(result).toHaveProperty('reason');
    });

    it('should disable all features in fallback mode', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);
      expect(result.mode).toBe('fallback');
      expect(result.features.pubSub).toBeFalsy();
      expect(result.features.taskQueue).toBeFalsy();
      expect(result.features.scheduler).toBeFalsy();
      expect(result.features.blake3).toBeFalsy();
    });

    it('should handle various dbPath formats', async () => {
      const paths = [
        '/absolute/path/db.db',
        './relative/path/db.db',
        '../sibling/path/db.db',
        '/path/with spaces/db.db',
        '/path/with-special_chars-123/db.db'
      ];

      for (const dbPath of paths) {
        const options: HonkerLoadOptions = {
          blake3ExtensionPath: '/nonexistent.so',
          dbPath,
          extensionPath: '/nonexistent.so'
        };

        const result = await loadHonkerExtension(options);
        expect(result.dbPath).toBe(dbPath);
      }
    });

    it('should handle extension paths consistently', async () => {
      const extensionPath = '/path/to/honker.so';
      const blake3Path = '/path/to/blake3.so';

      const options: HonkerLoadOptions = {
        blake3ExtensionPath: blake3Path,
        dbPath: SAFE_DB_PATH,
        extensionPath
      };

      const result = await loadHonkerExtension(options);

      // Result should be consistent (either native with both features or fallback)
      expect(result.mode).toBeDefined();
      expect(result.features).toBeDefined();
    });
  });

  describe('Interface contracts', () => {
    it('HonkerLoadOptions should have required properties', () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/path/to/blake3.so',
        dbPath: SAFE_ALT_DB_PATH,
        extensionPath: '/path/to/honker.so'
      };

      expect(options.dbPath).toBeDefined();
      expect(options.extensionPath).toBeDefined();
      expect(options.blake3ExtensionPath).toBeDefined();
    });

    it('HonkerLoadResult should include mode and dbPath', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.mode).toBeDefined();
      expect(['native', 'fallback']).toContain(result.mode);
      expect(result.dbPath).toBeDefined();
      expectTypeOf(result.dbPath).toBeString();
    });

    it('HonkerLoadFeatures should match expected structure', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent.so'
      };

      const result = await loadHonkerExtension(options);
      const { features } = result;

      expect(features.pubSub).toBeDefined();
      expect(features.taskQueue).toBeDefined();
      expect(features.scheduler).toBeDefined();
      expect(features.blake3).toBeDefined();

      expectTypeOf(features.pubSub).toBeBoolean();
      expectTypeOf(features.taskQueue).toBeBoolean();
      expectTypeOf(features.scheduler).toBeBoolean();
      expectTypeOf(features.blake3).toBeBoolean();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty string paths gracefully', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '',
        dbPath: '',
        extensionPath: ''
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.mode).toBeDefined();
    });

    it('should handle paths with unicode characters', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: SAFE_UNICODE_BLAKE3_PATH,
        dbPath: join(SAFE_TEST_ROOT, '数据库', 'db.db'),
        extensionPath: SAFE_UNICODE_HONKER_PATH
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.dbPath).toBe(options.dbPath);
    });

    it('should handle very long paths', async () => {
      const longPath = `/very/long/${'deep/'.repeat(50)}db.db`;
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent.so',
        dbPath: longPath,
        extensionPath: '/nonexistent.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.dbPath).toBe(longPath);
    });

    it('should not throw on missing file access', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/root/restricted/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/root/restricted/honker.so' // Likely no access
      };

      const result = await loadHonkerExtension(options);
      expect(result).toBeDefined();
    });
  });

  describe('Extension detection logic', () => {
    it('should return different results based on availability', async () => {
      // First check with nonexistent paths
      const result1 = await loadHonkerExtension({
        blake3ExtensionPath: '/definitely/not/here1.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/definitely/not/here1.so'
      });

      // Then check with different nonexistent paths
      const result2 = await loadHonkerExtension({
        blake3ExtensionPath: '/definitely/not/here2.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/definitely/not/here2.so'
      });

      // Both should be in fallback mode (but might have different reasons)
      expect(result1.mode).toBe('fallback');
      expect(result2.mode).toBe('fallback');

      // dbPath should remain the same
      expect(result1.dbPath).toBe(result2.dbPath);
    });

    it('should have consistent fallback feature flags', async () => {
      const options: HonkerLoadOptions = {
        blake3ExtensionPath: '/nonexistent/blake3.so',
        dbPath: SAFE_DB_PATH,
        extensionPath: '/nonexistent/honker.so'
      };

      const result1 = await loadHonkerExtension(options);
      const result2 = await loadHonkerExtension(options);

      // Both calls with same missing files should return same result
      expect(result1.mode).toBe(result2.mode);
      expect(result1.features).toStrictEqual(result2.features);
    });
  });
});
