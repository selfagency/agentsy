import { describe, it, expect } from 'vitest';
import { isProviderTool, providerToolToNative, nativeToProviderTool } from './providerToolsContract.js';

describe('Provider Tools Contract', () => {
  describe('additional edge cases', () => {
    it('should consider missing parameters as valid in isProviderTool', () => {
      const tool: any = {
        name: 'edgeTool',
        // parameters intentionally omitted to test default handling
      };
      expect(isProviderTool(tool)).toBe(true);
    });

    it('should handle missing parameters when converting to native format', () => {
      const providerTool: any = {
        name: 'edgeTool',
        // undefined parameters should default to empty object
        id: 'id-123',
      };
      const native = providerToolToNative(providerTool);
      expect(native).toEqual({ name: 'edgeTool', arguments: {}, id: 'id-123' });
    });

    it('should convert native tool to provider format without id', () => {
      const nativeTool = { name: 'edgeTool', arguments: { a: 1 } } as any;
      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toEqual({ name: 'edgeTool', parameters: { a: 1 }, format: 'native-json' });
      // Ensure id is not added when undefined
      expect((provider as any).id).toBeUndefined();
    });
  });
  describe('isProviderTool', () => {
    it('should return true for valid provider tool', () => {
      const validTool = {
        name: 'testTool',
        parameters: { key: 'value' },
        id: 'testId',
        format: 'native-json' as const,
      };
      expect(isProviderTool(validTool)).toBe(true);
    });

    it('should return false for invalid provider tool', () => {
      const invalidTool = {
        name: '',
        parameters: { key: 'value' },
      };
      expect(isProviderTool(invalidTool)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isProviderTool(null)).toBe(false);
      expect(isProviderTool(undefined)).toBe(false);
      expect(isProviderTool('string')).toBe(false);
      expect(isProviderTool(123)).toBe(false);
    });
  });

  describe('providerToolToNative', () => {
    it('should convert provider tool to native format', () => {
      const providerTool = {
        name: 'testTool',
        parameters: { key: 'value' },
        id: 'testId',
      };

      const native = providerToolToNative(providerTool);
      expect(native).toEqual({
        name: 'testTool',
        arguments: { key: 'value' },
        id: 'testId',
      });
    });

    it('should handle missing parameters', () => {
      const providerTool = {
        name: 'testTool',
        parameters: {},
        id: 'testId',
      };

      const native = providerToolToNative(providerTool);
      expect(native).toEqual({
        name: 'testTool',
        arguments: {},
        id: 'testId',
      });
    });
  });

  describe('nativeToProviderTool', () => {
    it('should convert native tool to provider format', () => {
      const nativeTool = {
        name: 'testTool',
        arguments: { key: 'value' },
        id: 'testId',
      };

      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toEqual({
        name: 'testTool',
        parameters: { key: 'value' },
        id: 'testId',
        format: 'native-json',
      });
    });

    it('should handle missing arguments', () => {
      const nativeTool = {
        name: 'testTool',
        arguments: {},
        id: 'testId',
      };

      const provider = nativeToProviderTool(nativeTool);
      expect(provider).toEqual({
        name: 'testTool',
        parameters: {},
        id: 'testId',
        format: 'native-json',
      });
    });
  });
});
