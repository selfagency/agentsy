import { describe, it, expect } from 'vitest';
import {
  createRepairState,
  feedCharToStateMachine,
  closeRepairState,
  repairJsonWithStateMachine,
} from './repairStateMachine.js';

describe('repairStateMachine', () => {
  describe('createRepairState', () => {
    it('creates initial state with empty stacks', () => {
      const state = createRepairState();
      expect(state.bracketStack).toEqual([]);
      expect(state.inString).toBe(false);
      expect(state.escaped).toBe(false);
      expect(state.lastSafeEnd).toBe(-1);
      expect(state.buffer).toBe('');
    });
  });

  describe('feedCharToStateMachine', () => {
    it('handles simple object', () => {
      const state = createRepairState();
      const input = '{"key":"value"}';
      for (const char of input) {
        feedCharToStateMachine(char, state);
      }
      expect(state.bracketStack).toEqual([]);
      expect(state.inString).toBe(false);
      expect(state.lastSafeEnd).toBeGreaterThan(0);
    });

    it('handles escape sequences in strings', () => {
      const state = createRepairState();
      const input = '{"key":"val\\"ue"}';
      for (const char of input) {
        feedCharToStateMachine(char, state);
      }
      expect(state.buffer).toContain('\\"');
      expect(state.bracketStack).toEqual([]);
    });

    it('tracks nested objects', () => {
      const state = createRepairState();
      const input = '{"a":{"b":';
      for (const char of input) {
        feedCharToStateMachine(char, state);
      }
      expect(state.bracketStack).toEqual(['}', '}']);
    });

    it('handles arrays', () => {
      const state = createRepairState();
      const input = '[1,2,3]';
      for (const char of input) {
        feedCharToStateMachine(char, state);
      }
      expect(state.bracketStack).toEqual([]);
    });

    it('ignores mismatched closing brackets', () => {
      const state = createRepairState();
      const input = '{"key":}';
      for (const char of input) {
        feedCharToStateMachine(char, state);
      }
      // The stray '}' is added to buffer but doesn't match the stack
      expect(state.buffer).toContain('key');
    });
  });

  describe('closeRepairState', () => {
    it('closes unclosed objects', () => {
      const state = createRepairState();
      state.bracketStack = ['}'];
      state.buffer = '{"key":"value"';
      const result = closeRepairState(state);
      expect(result).toBe('{"key":"value"}');
    });

    it('closes unclosed strings', () => {
      const state = createRepairState();
      state.inString = true;
      state.buffer = '{"key":"value';
      state.bracketStack = ['}'];
      const result = closeRepairState(state);
      expect(result).toBe('{"key":"value"}');
    });

    it('closes both unclosed strings and brackets', () => {
      const state = createRepairState();
      state.inString = true;
      state.bracketStack = ['}'];
      state.buffer = '{"key":"value';
      const result = closeRepairState(state);
      expect(result).toBe('{"key":"value"}');
    });

    it('closes nested unclosed brackets in reverse order', () => {
      const state = createRepairState();
      state.bracketStack = ['}', '}'];
      state.buffer = '{"a":{"b":1';
      const result = closeRepairState(state);
      expect(result).toBe('{"a":{"b":1}}');
    });
  });

  describe('repairJsonWithStateMachine', () => {
    it('repairs truncated simple object', () => {
      const input = '{"key":"value';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.key).toBe('value');
    });

    it('repairs truncated array', () => {
      const input = '[1,2,3';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([1, 2, 3]);
    });

    it('repairs nested truncated objects', () => {
      const input = '{"a":{"b":{"c":true';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.a.b.c).toBe(true);
    });

    it('preserves complete valid JSON', () => {
      const input = '{"key":"value","number":42,"bool":true,"null":null,"arr":[1,2,3]}';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.key).toBe('value');
      expect(parsed.number).toBe(42);
      expect(parsed.bool).toBe(true);
      expect(parsed.null).toBe(null);
      expect(parsed.arr).toEqual([1, 2, 3]);
    });

    it('handles strings with escaped quotes', () => {
      const input = '{"key":"value\\"with\\"quotes';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.key).toContain('with');
    });

    it('handles strings with escape sequences', () => {
      const input = '{"key":"line1\\nline2';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.key).toContain('line1');
    });

    it('ignores mismatched closing brackets', () => {
      const input = '{"a":1}]';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.a).toBe(1);
    });

    it('handles mixed nesting', () => {
      const input = '{"items":[{"id":1,"tags":["a","b';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(Array.isArray(parsed.items[0].tags)).toBe(true);
    });

    it('repairs JSON with trailing LLM prose', () => {
      const input = '{"result":"success"}\nSome trailing text';
      const result = repairJsonWithStateMachine(input);
      // This should preserve up to the valid JSON but not the trailing prose
      expect(result.startsWith('{"result":"success"}')).toBe(true);
    });

    it('handles empty objects and arrays', () => {
      const input = '{"empty_obj":{},"empty_arr":[]}';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('handles unicode escape sequences', () => {
      const input = '{"unicode":"\\u0048ello';
      const result = repairJsonWithStateMachine(input);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
