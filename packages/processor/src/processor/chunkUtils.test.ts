import { describe, expect, it } from 'vitest';
import { ensureText, estimateChunkSize, mapNativeToolCalls, normalizeToolArguments } from './chunkUtils.js';

describe('chunkUtils', () => {
  describe('ensureText', () => {
    it('returns string values unchanged and non-strings as empty string', () => {
      expect(ensureText('hello')).toBe('hello');
      expect(ensureText(123)).toBe('');
      expect(ensureText(null)).toBe('');
      expect(ensureText(undefined)).toBe('');
    });
  });

  describe('normalizeToolArguments', () => {
    it('returns object values as-is', () => {
      expect(normalizeToolArguments({ a: 1 })).toEqual({ a: 1 });
    });

    it('parses JSON strings into objects', () => {
      expect(normalizeToolArguments('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns empty object for malformed, non-object, or empty inputs', () => {
      expect(normalizeToolArguments('{not json')).toEqual({});
      expect(normalizeToolArguments('[]')).toEqual({});
      expect(normalizeToolArguments('')).toEqual({});
      expect(normalizeToolArguments(42)).toEqual({});
    });
  });

  describe('mapNativeToolCalls', () => {
    it('maps valid native calls and ignores invalid/missing-name calls', () => {
      const calls = [
        { function: { name: 'read_file', arguments: { path: './fixtures/a.ts' } } },
        { function: { name: '', arguments: {} } },
        { function: { arguments: {} } },
      ];

      expect(mapNativeToolCalls(calls as never)).toEqual([
        {
          name: 'read_file',
          parameters: { path: './fixtures/a.ts' },
          format: 'native-json',
        },
      ]);
    });

    it('normalizes stringified argument payloads', () => {
      const calls = [{ function: { name: 'tool', arguments: '{"x":1}' } }];
      expect(mapNativeToolCalls(calls as never)).toEqual([
        {
          name: 'tool',
          parameters: { x: 1 },
          format: 'native-json',
        },
      ]);
    });

    it('returns empty for non-array or empty input', () => {
      expect(mapNativeToolCalls(undefined)).toEqual([]);
      expect(mapNativeToolCalls([])).toEqual([]);
    });
  });

  describe('estimateChunkSize', () => {
    it('counts serializable chunk fields and skips unserializable entries', () => {
      const encoder = new TextEncoder();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      const size = estimateChunkSize(
        {
          content: 'abc',
          thinking: 'def',
          tool_calls: [{ function: { name: 'ok', arguments: { a: 1 } } }, circular as never],
          nativeToolCallDeltas: [{ index: 0, name: 'tool', argumentsDelta: '{"a":1}' }],
        },
        encoder,
      );

      expect(size).toBeGreaterThan(0);
    });
  });
});
