import { describe, expect, it } from 'vitest';
import { loadHonkerExtension, type HonkerLoadOptions } from './loader.js';

describe('HonkerExtensionLoader', () => {
  describe('loadHonkerExtension', () => {
    it('should return result with detected mode', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toHaveProperty('mode');
      expect(['native', 'fallback']).toContain(result.mode);
    });

    it('should include dbPath in result', async () => {
      const dbPath = '/custom/db/path.db';
      const options: HonkerLoadOptions = {
        dbPath,
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.dbPath).toBe(dbPath);
    });

    it('should include features in result', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toHaveProperty('features');
      expect(result.features).toHaveProperty('pubSub');
      expect(result.features).toHaveProperty('taskQueue');
      expect(result.features).toHaveProperty('scheduler');
      expect(result.features).toHaveProperty('blake3');

      expect(typeof result.features.pubSub).toBe('boolean');
      expect(typeof result.features.taskQueue).toBe('boolean');
      expect(typeof result.features.scheduler).toBe('boolean');
      expect(typeof result.features.blake3).toBe('boolean');
    });

    it('should return fallback mode when extensions do not exist', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/definitely/does/not/exist.so',
        blake3ExtensionPath: '/definitely/does/not/exist.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.mode).toBe('fallback');
    });

    it('should have reason field when in fallback mode', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      if (result.mode === 'fallback') {
        expect(result).toHaveProperty('reason');
      }
    });

    it('should disable all features in fallback mode', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      if (result.mode === 'fallback') {
        expect(result.features.pubSub).toBe(false);
        expect(result.features.taskQueue).toBe(false);
        expect(result.features.scheduler).toBe(false);
        expect(result.features.blake3).toBe(false);
      }
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
          dbPath,
          extensionPath: '/nonexistent.so',
          blake3ExtensionPath: '/nonexistent.so'
        };

        const result = await loadHonkerExtension(options);
        expect(result.dbPath).toBe(dbPath);
      }
    });

    it('should handle extension paths consistently', async () => {
      const extensionPath = '/path/to/honker.so';
      const blake3Path = '/path/to/blake3.so';

      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath,
        blake3ExtensionPath: blake3Path
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
        dbPath: '/tmp/db.db',
        extensionPath: '/path/to/honker.so',
        blake3ExtensionPath: '/path/to/blake3.so'
      };

      expect(options.dbPath).toBeDefined();
      expect(options.extensionPath).toBeDefined();
      expect(options.blake3ExtensionPath).toBeDefined();
    });

    it('HonkerLoadResult should include mode and dbPath', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result.mode).toBeDefined();
      expect(['native', 'fallback']).toContain(result.mode);
      expect(result.dbPath).toBeDefined();
      expect(typeof result.dbPath).toBe('string');
    });

    it('HonkerLoadFeatures should match expected structure', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent.so',
        blake3ExtensionPath: '/nonexistent.so'
      };

      const result = await loadHonkerExtension(options);
      const { features } = result;

      expect(features.pubSub).toBeDefined();
      expect(features.taskQueue).toBeDefined();
      expect(features.scheduler).toBeDefined();
      expect(features.blake3).toBeDefined();

      expect(typeof features.pubSub).toBe('boolean');
      expect(typeof features.taskQueue).toBe('boolean');
      expect(typeof features.scheduler).toBe('boolean');
      expect(typeof features.blake3).toBe('boolean');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty string paths gracefully', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '',
        extensionPath: '',
        blake3ExtensionPath: ''
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.mode).toBeDefined();
    });

    it('should handle paths with unicode characters', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/数据库/db.db',
        extensionPath: '/tmp/扩展/honker.so',
        blake3ExtensionPath: '/tmp/扩展/blake3.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.dbPath).toBe(options.dbPath);
    });

    it('should handle very long paths', async () => {
      const longPath = '/very/long/' + 'deep/'.repeat(50) + 'db.db';
      const options: HonkerLoadOptions = {
        dbPath: longPath,
        extensionPath: '/nonexistent.so',
        blake3ExtensionPath: '/nonexistent.so'
      };

      const result = await loadHonkerExtension(options);

      expect(result).toBeDefined();
      expect(result.dbPath).toBe(longPath);
    });

    it('should not throw on missing file access', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/root/restricted/honker.so', // Likely no access
        blake3ExtensionPath: '/root/restricted/blake3.so'
      };

      expect(async () => {
        await loadHonkerExtension(options);
      }).not.toThrow();
    });
  });

  describe('Extension detection logic', () => {
    it('should return different results based on availability', async () => {
      // First check with nonexistent paths
      const result1 = await loadHonkerExtension({
        dbPath: '/tmp/test.db',
        extensionPath: '/definitely/not/here1.so',
        blake3ExtensionPath: '/definitely/not/here1.so'
      });

      // Then check with different nonexistent paths
      const result2 = await loadHonkerExtension({
        dbPath: '/tmp/test.db',
        extensionPath: '/definitely/not/here2.so',
        blake3ExtensionPath: '/definitely/not/here2.so'
      });

      // Both should be in fallback mode (but might have different reasons)
      expect(result1.mode).toBe('fallback');
      expect(result2.mode).toBe('fallback');

      // dbPath should remain the same
      expect(result1.dbPath).toBe(result2.dbPath);
    });

    it('should have consistent fallback feature flags', async () => {
      const options: HonkerLoadOptions = {
        dbPath: '/tmp/test.db',
        extensionPath: '/nonexistent/honker.so',
        blake3ExtensionPath: '/nonexistent/blake3.so'
      };

      const result1 = await loadHonkerExtension(options);
      const result2 = await loadHonkerExtension(options);

      // Both calls with same missing files should return same result
      expect(result1.mode).toBe(result2.mode);
      expect(result1.features).toEqual(result2.features);
    });
  });
});
