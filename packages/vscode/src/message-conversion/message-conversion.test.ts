import { describe, expect, it } from 'vitest';
import { convertMessage, convertMessages } from './message-adapter.js';
import { convertRole, extractTextFromPart, extractToolCall, extractToolResult } from './role-converter.js';

describe('role-converter', () => {
  describe('convertRole', () => {
    it('maps role 2 to assistant', () => {
      expect(convertRole(2)).toBe('assistant');
    });

    it('maps role 1 to user', () => {
      expect(convertRole(1)).toBe('user');
    });

    it('maps unknown roles to user', () => {
      expect(convertRole(99)).toBe('user');
    });
  });

  describe('extractTextFromPart', () => {
    it('extracts value property', () => {
      expect(extractTextFromPart({ value: 'hello' })).toBe('hello');
    });

    it('extracts content property when no value', () => {
      expect(extractTextFromPart({ content: 'world' })).toBe('world');
    });

    it('returns empty string for null', () => {
      expect(extractTextFromPart(null)).toBe('');
    });

    it('returns empty string when no matching property', () => {
      expect(extractTextFromPart({ text: 'no match' })).toBe('');
    });
  });

  describe('extractToolCall', () => {
    it('extracts tool call with object arguments', () => {
      const result = extractToolCall({
        callId: 'call-1',
        name: 'myTool',
        input: { foo: 'bar' },
      });
      expect(result).toEqual({ id: 'call-1', name: 'myTool', arguments: { foo: 'bar' } });
    });

    it('parses JSON string arguments', () => {
      const result = extractToolCall({
        callId: 'call-2',
        name: 'fn',
        input: '{"x": 42}',
      });
      expect(result?.arguments).toEqual({ x: 42 });
    });

    it('returns undefined for missing callId', () => {
      expect(extractToolCall({ name: 'fn', input: {} })).toBeUndefined();
    });

    it('returns empty arguments for invalid JSON string', () => {
      const result = extractToolCall({ callId: 'id', name: 'fn', input: 'invalid json' });
      expect(result?.arguments).toEqual({});
    });

    it('returns undefined for non-objects', () => {
      expect(extractToolCall(null)).toBeUndefined();
      expect(extractToolCall('string')).toBeUndefined();
    });
  });

  describe('extractToolResult', () => {
    it('extracts tool result with array content', () => {
      const result = extractToolResult({
        callId: 'call-1',
        content: [{ value: 'result text' }],
      });
      expect(result).toEqual({ callId: 'call-1', content: 'result text' });
    });

    it('extracts tool result with string content', () => {
      const result = extractToolResult({ callId: 'call-2', content: 'direct' });
      expect(result).toEqual({ callId: 'call-2', content: 'direct' });
    });

    it('returns undefined for missing callId', () => {
      expect(extractToolResult({ content: [] })).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(extractToolResult(null)).toBeUndefined();
    });
  });
});

describe('message-adapter', () => {
  describe('convertMessage', () => {
    it('converts string content message', () => {
      const result = convertMessage({ role: 1, content: 'Hello' });
      expect(result).toEqual({ role: 'user', content: 'Hello' });
    });

    it('converts assistant message', () => {
      const result = convertMessage({ role: 2, content: 'Hi there' });
      expect(result).toEqual({ role: 'assistant', content: 'Hi there' });
    });

    it('handles null/undefined message', () => {
      expect(convertMessage(null)).toEqual({ role: 'user', content: '' });
      expect(convertMessage(undefined)).toEqual({ role: 'user', content: '' });
    });

    it('handles empty content array', () => {
      const result = convertMessage({ role: 1, content: [] });
      expect(result).toEqual({ role: 'user', content: '' });
    });

    it('concatenates text parts', () => {
      const result = convertMessage({
        role: 1,
        content: [{ value: 'Hello ' }, { value: 'world' }],
      });
      expect(result.content).toBe('Hello world');
    });

    it('extracts tool calls from content parts', () => {
      const result = convertMessage({
        role: 2,
        content: [{ callId: 'c1', name: 'myTool', input: { a: 1 } }],
      });
      expect(result.toolCalls).toEqual([{ id: 'c1', name: 'myTool', arguments: { a: 1 } }]);
      expect(result.role).toBe('assistant');
    });

    it('converts tool result message', () => {
      const result = convertMessage({
        role: 1,
        content: [{ callId: 'c1', content: [{ value: 'result' }] }],
      });
      expect(result.role).toBe('tool');
      expect(result.toolCallId).toBe('c1');
      expect(result.content).toBe('result');
    });

    it('includes name if present', () => {
      const result = convertMessage({ role: 1, content: 'msg', name: 'system' });
      expect(result.name).toBe('system');
    });
  });

  describe('convertMessages', () => {
    it('converts array of messages', () => {
      const msgs = [
        { role: 1, content: 'Hi' },
        { role: 2, content: 'Hello' },
      ];
      const result = convertMessages(msgs);
      expect(result).toHaveLength(2);
      const [firstMessage, secondMessage] = result;
      if (!firstMessage || !secondMessage) {
        throw new Error('Expected two messages to be converted');
      }
      expect(firstMessage.role).toBe('user');
      expect(secondMessage.role).toBe('assistant');
    });

    it('returns empty array for empty input', () => {
      expect(convertMessages([])).toEqual([]);
    });
  });
});
