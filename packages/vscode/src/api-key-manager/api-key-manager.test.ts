import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockExtensionContext } from '../test/fixtures/mock-vscode.js';
import type { ApiKeyManagerConfig } from '../types/index.js';
import { ApiKeyManager } from './api-key-manager.js';

describe('ApiKeyManager', () => {
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let config: ApiKeyManagerConfig;
  let manager: ApiKeyManager;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    config = {
      secretKey: 'TEST_API_KEY',
      contextKey: 'test.hasApiKey',
      displayName: 'Test API Key',
    };
    manager = new ApiKeyManager(mockContext, config);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('initialization', () => {
    it('should initialize without error', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await manager.initialize();
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should load stored API key on initialization', async () => {
      await mockContext.secrets.store('TEST_API_KEY', 'stored-key-value');
      const freshManager = new ApiKeyManager(mockContext, config);
      await freshManager.initialize();
      const key = await freshManager.getApiKey();
      expect(key).toBe('stored-key-value');
    });
  });

  describe('getApiKey', () => {
    it('should return undefined when no key is stored', async () => {
      const key = await manager.getApiKey();
      expect(key).toBeUndefined();
    });

    it('should return stored key', async () => {
      await mockContext.secrets.store('TEST_API_KEY', 'my-api-key');
      const key = await manager.getApiKey();
      expect(key).toBe('my-api-key');
    });

    it('should auto-initialize on first call', async () => {
      await mockContext.secrets.store('TEST_API_KEY', 'auto-initialized-key');
      const key = await manager.getApiKey();
      expect(key).toBe('auto-initialized-key');
    });
  });

  describe('hasApiKey', () => {
    it('should return false when no key is stored', async () => {
      const has = await manager.hasApiKey();
      expect(has).toBe(false);
    });

    it('should return true when key is stored', async () => {
      await manager.setApiKey('test-key');
      const has = await manager.hasApiKey();
      expect(has).toBe(true);
    });
  });

  describe('setApiKey', () => {
    it('should store API key', async () => {
      await manager.setApiKey('new-key');
      const stored = await mockContext.secrets.get('TEST_API_KEY');
      expect(stored).toBe('new-key');
    });

    it('should notify listeners on set', async () => {
      const listener = vi.fn();
      manager.onDidChangeApiKey(listener);
      await manager.setApiKey('new-key');
      expect(listener).toHaveBeenCalledWith('updated', 'new-key');
    });

    it('should validate before storing if validator provided', async () => {
      const validator = vi.fn().mockResolvedValue(true);
      const configWithValidator: ApiKeyManagerConfig = {
        ...config,
        validateBeforeStore: validator,
      };
      const validatingManager = new ApiKeyManager(mockContext, configWithValidator);
      await validatingManager.setApiKey('test-key');
      expect(validator).toHaveBeenCalledWith('test-key');
    });

    it('should throw if validation fails', async () => {
      const configWithValidator: ApiKeyManagerConfig = {
        ...config,
        validateBeforeStore: () => false,
      };
      const validatingManager = new ApiKeyManager(mockContext, configWithValidator);
      await expect(validatingManager.setApiKey('invalid-key')).rejects.toThrow('API key validation failed');
    });

    it('should call onError if validation fails', async () => {
      const onError = vi.fn();
      const configWithValidator: ApiKeyManagerConfig = {
        ...config,
        validateBeforeStore: () => false,
        onError,
      };
      const validatingManager = new ApiKeyManager(mockContext, configWithValidator);
      try {
        await validatingManager.setApiKey('invalid-key');
      } catch {
        // Expected
      }
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('deleteApiKey', () => {
    beforeEach(async () => {
      await manager.setApiKey('key-to-delete');
    });

    it('should delete the stored key', async () => {
      await manager.deleteApiKey();
      const stored = await mockContext.secrets.get('TEST_API_KEY');
      expect(stored).toBeUndefined();
    });

    it('should notify listeners on delete', async () => {
      const listener = vi.fn();
      manager.onDidChangeApiKey(listener);
      await manager.deleteApiKey();
      expect(listener).toHaveBeenCalledWith('deleted', undefined);
    });

    it('should return undefined from getApiKey after delete', async () => {
      await manager.deleteApiKey();
      const key = await manager.getApiKey();
      expect(key).toBeUndefined();
    });
  });

  describe('listeners', () => {
    it('should support multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      manager.onDidChangeApiKey(listener1);
      manager.onDidChangeApiKey(listener2);
      await manager.setApiKey('test-key');
      expect(listener1).toHaveBeenCalledWith('updated', 'test-key');
      expect(listener2).toHaveBeenCalledWith('updated', 'test-key');
    });

    it('should support removing listeners', async () => {
      const listener = vi.fn();
      manager.onDidChangeApiKey(listener);
      manager.offDidChangeApiKey(listener);
      await manager.setApiKey('test-key');
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns a disposable from onDidChangeApiKey', async () => {
      const listener = vi.fn();
      const disposable = manager.onDidChangeApiKey(listener);

      disposable.dispose();
      await manager.setApiKey('test-key');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      manager.onDidChangeApiKey(errorListener);
      manager.onDidChangeApiKey(goodListener);
      await expect(manager.setApiKey('test-key')).resolves.not.toThrow();
      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled(); // Should still be called
    });
  });

  describe('debug helpers', () => {
    it('should mask API key in debug output', async () => {
      await manager.setApiKey('secret-1234-key-5678');
      const masked = await manager._debugShowStoredKey();
      expect(masked).toMatch(/^secr\*+5678$/);
      expect(masked).not.toContain('secret');
      expect(masked).not.toContain('1234');
    });

    it('should return undefined for empty key', async () => {
      const masked = await manager._debugShowStoredKey();
      expect(masked).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should clear all listeners', async () => {
      const listener = vi.fn();
      manager.onDidChangeApiKey(listener);
      manager.dispose();
      await manager.setApiKey('test-key');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
