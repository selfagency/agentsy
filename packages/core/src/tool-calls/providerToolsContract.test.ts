import { describe, expect, it } from 'vitest';

import { isProviderTool, nativeToProviderTool, providerToolToNative } from './providerToolsContract.js';

describe('Provider Tools Contract', () => {
  describe('additional edge cases', () => {
    it('should require parameters in isProviderTool', () => {
      const tool = {
        name: 'edgeTool'
        // parameters intentionally omitted - should fail validation
      };
      expect(isProviderTool(tool)).toBeFalsy();
    });

    it('should require parameters when converting to native format', () => {
      const providerTool = {
        id: 'id-123',
        name: 'edgeTool'
      };
      expect(isProviderTool(providerTool)).toBeFalsy();
    });

    it('should convert native tool to provider format correctly', () => {
      const nativeTool = { arguments: { a: 1 }, name: 'edgeTool' };
      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toStrictEqual({
        format: 'native-json',
        name: 'edgeTool',
        parameters: { a: 1 }
      });
      expect(provider.id).toBeUndefined();
    });
  });

  describe(isProviderTool, () => {
    it('should return true for valid provider tool', () => {
      const validTool = {
        format: 'native-json' as const,
        id: 'testId',
        name: 'testTool',
        parameters: { key: 'value' }
      };
      expect(isProviderTool(validTool)).toBeTruthy();
    });

    it('should return false for invalid provider tool', () => {
      const invalidTool = {
        name: '',
        parameters: { key: 'value' }
      };
      expect(isProviderTool(invalidTool)).toBeFalsy();
    });

    it('should return false for non-object', () => {
      expect(isProviderTool(null)).toBeFalsy();
      expect(isProviderTool('string')).toBeFalsy();
      expect(isProviderTool(123)).toBeFalsy();
    });
  });

  describe(providerToolToNative, () => {
    it('should convert provider tool to native format', () => {
      const providerTool = {
        id: 'testId',
        name: 'testTool',
        parameters: { key: 'value' }
      };

      const native = providerToolToNative(providerTool);
      expect(native).toStrictEqual({
        arguments: { key: 'value' },
        id: 'testId',
        name: 'testTool'
      });
    });

    it('should handle missing parameters', () => {
      const providerTool = {
        id: 'testId',
        name: 'testTool',
        parameters: {}
      };

      const native = providerToolToNative(providerTool);
      expect(native).toStrictEqual({
        arguments: {},
        id: 'testId',
        name: 'testTool'
      });
    });
  });

  describe(nativeToProviderTool, () => {
    it('should convert native tool to provider format', () => {
      const nativeTool = {
        arguments: { key: 'value' },
        id: 'testId',
        name: 'testTool'
      };

      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toStrictEqual({
        format: 'native-json',
        id: 'testId',
        name: 'testTool',
        parameters: { key: 'value' }
      });
    });

    it('should handle missing arguments', () => {
      const nativeTool = {
        arguments: {},
        id: 'testId',
        name: 'testTool'
      };

      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toStrictEqual({
        format: 'native-json',
        id: 'testId',
        name: 'testTool',
        parameters: {}
      });
    });
  });
});
