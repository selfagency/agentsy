import { describe, expect, it } from 'vitest';

import { convertMessage, convertMessages } from './message-adapter.js';
import { convertRole, extractTextFromPart, extractToolCall, extractToolResult } from './role-converter.js';

describe('role-converter', () => {
  describe(convertRole, () => {
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

  describe(extractTextFromPart, () => {
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

  describe(extractToolCall, () => {
    it('extracts tool call with object arguments', () => {
      const result = extractToolCall({
        callId: 'call-1',
        input: { foo: 'bar' },
        name: 'myTool'
      });
      expect(result).toStrictEqual({
        arguments: { foo: 'bar' },
        id: 'call-1',
        name: 'myTool'
      });
    });

    it('parses JSON string arguments', () => {
      const result = extractToolCall({
        callId: 'call-2',
        input: '{"x": 42}',
        name: 'fn'
      });
      expect(result?.arguments).toStrictEqual({ x: 42 });
    });

    it('returns undefined for missing callId', () => {
      expect(extractToolCall({ input: {}, name: 'fn' })).toBeUndefined();
    });

    it('returns empty arguments for invalid JSON string', () => {
      const result = extractToolCall({
        callId: 'id',
        input: 'invalid json',
        name: 'fn'
      });
      expect(result?.arguments).toStrictEqual({});
    });

    it('returns undefined for non-objects', () => {
      expect(extractToolCall(null)).toBeUndefined();
      expect(extractToolCall('string')).toBeUndefined();
    });
  });

  describe(extractToolResult, () => {
    it('extracts tool result with array content', () => {
      const result = extractToolResult({
        callId: 'call-1',
        content: [{ value: 'result text' }]
      });
      expect(result).toStrictEqual({
        callId: 'call-1',
        content: 'result text'
      });
    });

    it('extracts tool result with string content', () => {
      const result = extractToolResult({ callId: 'call-2', content: 'direct' });
      expect(result).toStrictEqual({ callId: 'call-2', content: 'direct' });
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
  describe(convertMessage, () => {
    it('converts string content message', () => {
      const result = convertMessage({ content: 'Hello', role: 1 });
      expect(result).toStrictEqual({ content: 'Hello', role: 'user' });
    });

    it('converts assistant message', () => {
      const result = convertMessage({ content: 'Hi there', role: 2 });
      expect(result).toStrictEqual({ content: 'Hi there', role: 'assistant' });
    });

    it('handles null/undefined message', () => {
      expect(convertMessage(null)).toStrictEqual({ content: '', role: 'user' });
      expect(convertMessage(undefined)).toStrictEqual({ content: '', role: 'user' });
    });

    it('handles empty content array', () => {
      const result = convertMessage({ content: [], role: 1 });
      expect(result).toStrictEqual({ content: '', role: 'user' });
    });

    it('concatenates text parts', () => {
      const result = convertMessage({
        content: [{ value: 'Hello ' }, { value: 'world' }],
        role: 1
      });
      expect(result.content).toBe('Hello world');
    });

    it('extracts tool calls from content parts', () => {
      const result = convertMessage({
        content: [{ callId: 'c1', input: { a: 1 }, name: 'myTool' }],
        role: 2
      });
      expect(result.toolCalls).toStrictEqual([{ arguments: { a: 1 }, id: 'c1', name: 'myTool' }]);
      expect(result.role).toBe('assistant');
    });

    it('converts tool result message', () => {
      const result = convertMessage({
        content: [{ callId: 'c1', content: [{ value: 'result' }] }],
        role: 1
      });
      expect(result.role).toBe('tool');
      expect(result.toolCallId).toBe('c1');
      expect(result.content).toBe('result');
    });

    it('includes name if present', () => {
      const result = convertMessage({
        content: 'msg',
        name: 'system',
        role: 1
      });
      expect(result.name).toBe('system');
    });
  });

  describe(convertMessages, () => {
    it('converts array of messages', () => {
      const msgs = [
        { content: 'Hi', role: 1 },
        { content: 'Hello', role: 2 }
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
      expect(convertMessages([])).toStrictEqual([]);
    });
  });
});
