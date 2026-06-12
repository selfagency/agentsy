import { describe, expect, it } from 'vitest';

import { ContentPartSchema, createSessionState, MessageSchema, SessionStateSchema, ToolCallSchema } from './schema.js';

describe('MessageSchema', () => {
  it('accepts a text message', () => {
    const msg = MessageSchema.parse({
      role: 'user',
      content: 'hello'
    });
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
  });

  it('accepts a message with content parts', () => {
    const msg = MessageSchema.parse({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Here is an image:' },
        { type: 'image', imageUrl: 'https://example.com/img.png' }
      ]
    });
    expect(msg.content).toHaveLength(2);
  });

  it('rejects an invalid role', () => {
    expect(() => MessageSchema.parse({ role: 'admin', content: 'test' })).toThrow('Invalid enum value');
  });

  it('accepts a tool message', () => {
    const msg = MessageSchema.parse({
      content: 'result',
      role: 'tool',
      toolCallId: 'call_123'
    });
    expect(msg.role).toBe('tool');
    expect(msg.toolCallId).toBe('call_123');
  });
});

describe('ContentPartSchema', () => {
  it('parses text parts', () => {
    const part = ContentPartSchema.parse({ type: 'text', text: 'hello' });
    expect(part.type).toBe('text');
  });

  it('parses tool_call parts', () => {
    const part = ContentPartSchema.parse({
      id: 'call_1',
      input: { query: 'test' },
      name: 'search',
      type: 'tool_call'
    });
    expect(part.type).toBe('tool_call');
  });

  it('parses tool_result parts', () => {
    const part = ContentPartSchema.parse({
      content: 'result data',
      toolCallId: 'call_1',
      type: 'tool_result'
    });
    expect(part.type).toBe('tool_result');
  });

  it('rejects unknown part types', () => {
    expect(() => ContentPartSchema.parse({ type: 'audio', data: '...' })).toThrow('Invalid discriminator value');
  });
});

describe('ToolCallSchema', () => {
  it('parses a valid tool call', () => {
    const tc = ToolCallSchema.parse({
      id: 'tc_1',
      name: 'read_file',
      input: { path: '/home/user/test.txt' },
      status: 'pending'
    });
    expect(tc.name).toBe('read_file');
    expect(tc.status).toBe('pending');
  });

  it('rejects an invalid status', () => {
    expect(() =>
      ToolCallSchema.parse({
        id: 'tc_1',
        name: 'read_file',
        input: {},
        status: 'invalid'
      })
    ).toThrow();
  });
});

describe('SessionStateSchema', () => {
  it('parses a valid session state', () => {
    const state = SessionStateSchema.parse({
      sessionId: 'session_abc',
      threadId: 'thread_1',
      messages: [{ role: 'user', content: 'hello' }],
      toolCallQueue: [],
      checkpoints: [],
      meta: { model: 'gpt-4' },
      createdAt: 1_000_000,
      updatedAt: 1_000_001
    });
    expect(state.sessionId).toBe('session_abc');
    expect(state.messages).toHaveLength(1);
    expect(state.meta.model).toBe('gpt-4');
  });

  it('rejects a state with invalid message role', () => {
    expect(() =>
      SessionStateSchema.parse({
        sessionId: 'session_x',
        threadId: 'thread_1',
        messages: [{ role: 'hacker', content: 'pwnd' }],
        toolCallQueue: [],
        checkpoints: [],
        meta: {},
        createdAt: 1,
        updatedAt: 1
      })
    ).toThrow();
  });

  it('allows optional branchMeta', () => {
    const state = SessionStateSchema.parse({
      sessionId: 'session_a',
      threadId: 'thread_1',
      messages: [],
      toolCallQueue: [],
      checkpoints: [],
      branchMeta: {
        parentSessionId: 'session_0',
        parentThreadId: 'thread_0',
        forkedAt: 1_000_000,
        forkReason: 'user requested fork'
      },
      meta: {},
      createdAt: 0,
      updatedAt: 0
    });
    expect(state.branchMeta?.forkReason).toBe('user requested fork');
  });
});

describe('createSessionState', () => {
  it('creates a minimal valid state', () => {
    const state = createSessionState('session_1', 'thread_1');
    expect(state.sessionId).toBe('session_1');
    expect(state.messages).toEqual([]);
    expect(state.createdAt).toBeGreaterThan(0);
    expect(state.updatedAt).toBe(state.createdAt);
  });
});
