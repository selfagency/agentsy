import { describe, expect, it, vi } from 'vitest';
import {
  enforceMaxLength,
  ensureText,
  estimateChunkSize,
  mapNativeToolCalls,
  normalizeToolArguments
} from './chunkUtils.js';

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
        { function: { arguments: {} } }
      ];

      expect(mapNativeToolCalls(calls as never)).toEqual([
        {
          name: 'read_file',
          parameters: { path: './fixtures/a.ts' },
          format: 'native-json'
        }
      ]);
    });

    it('normalizes stringified argument payloads', () => {
      const calls = [{ function: { name: 'tool', arguments: '{"x":1}' } }];
      expect(mapNativeToolCalls(calls as never)).toEqual([
        {
          name: 'tool',
          parameters: { x: 1 },
          format: 'native-json'
        }
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
          nativeToolCallDeltas: [{ index: 0, name: 'tool', argumentsDelta: '{"a":1}' }]
        },
        encoder
      );

      expect(size).toBeGreaterThan(0);
    });
  });

  describe('enforceMaxLength', () => {
    it('returns unchanged value when within limit', () => {
      const warn = vi.fn();
      expect(enforceMaxLength('hello', 'content', 10, warn)).toBe('hello');
      expect(warn).not.toHaveBeenCalled();
    });

    it('truncates exactly at max length when no partial tag is present', () => {
      const warn = vi.fn();
      expect(enforceMaxLength('abcdef', 'content', 3, warn)).toBe('abc');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('backs up to opening bracket when truncation would cut a tag', () => {
      const warn = vi.fn();
      const input = 'text <tool_call name="x">payload';
      expect(enforceMaxLength(input, 'content', 14, warn)).toBe('text ');
    });

    it('returns full string when tag close is before truncation boundary', () => {
      const warn = vi.fn();
      const input = '<a>ok</a> tail';
      expect(enforceMaxLength(input, 'content', 10, warn)).toBe('<a>ok</a> ');
    });

    it('handles max length landing on an opening bracket by dropping partial fragment', () => {
      const warn = vi.fn();
      const input = 'hello <';
      expect(enforceMaxLength(input, 'thinking', 6, warn)).toBe('hello ');
    });

    it('returns empty string when oversized input starts with an unclosed tag', () => {
      const warn = vi.fn();
      const input = '<unclosed tag content';
      expect(enforceMaxLength(input, 'content', 5, warn)).toBe('');
    });

    it('applies maxInputLength as UTF-8 bytes (not UTF-16 code units)', () => {
      const warn = vi.fn();
      // 😀 is 4 bytes in UTF-8. Byte cap 6 should keep one emoji + "ab".
      const input = '😀ab😀';
      expect(enforceMaxLength(input, 'content', 6, warn)).toBe('😀ab');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not treat literal less-than as XML tag start', () => {
      const warn = vi.fn();
      const input = 'math: a < b and c';
      // 10 bytes => "math: a < "; should not backtrack to before '<'.
      expect(enforceMaxLength(input, 'thinking', 10, warn)).toBe('math: a < ');
    });
  });
});
