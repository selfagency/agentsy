import { describe, expect, it } from 'vitest';
import { reduceSessionState } from './reducers.js';
import { createSessionState, type SessionState } from './schema.js';

function freshState(): SessionState {
  return createSessionState('session_1', 'thread_1');
}

describe('reduceSessionState', () => {
  // ---- Messages -----------------------------------------------------------
  describe('appendMessage', () => {
    it('appends a message to the end', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'appendMessage',
        message: { role: 'user', content: 'hello' }
      });
      expect(next.messages).toHaveLength(1);
      expect(next.messages[0]?.content).toBe('hello');
    });

    it('does not mutate the original state', () => {
      const state = freshState();
      reduceSessionState(state, {
        type: 'appendMessage',
        message: { role: 'user', content: 'hello' }
      });
      expect(state.messages).toHaveLength(0);
    });

    it('updates updatedAt', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'updateTimestamps'
      });
      expect(next.updatedAt).toBeGreaterThanOrEqual(state.updatedAt);
    });
  });

  describe('updateMessage', () => {
    it('updates a message at a specific index', () => {
      const state = freshState();
      const withMsg = reduceSessionState(state, {
        type: 'appendMessage',
        message: { role: 'user', content: 'hello' }
      });
      const next = reduceSessionState(withMsg, {
        type: 'updateMessage',
        index: 0,
        message: { content: 'updated' }
      });
      expect(next.messages[0]?.content).toBe('updated');
      expect(next.messages[0]?.role).toBe('user'); // unchanged
    });

    it('returns state unchanged for out-of-bounds index', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'updateMessage',
        index: 999,
        message: { content: 'nope' }
      });
      expect(next).toStrictEqual(state);
    });
  });

  describe('replaceMessages', () => {
    it('replaces all messages', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'replaceMessages',
        messages: [
          { role: 'system', content: 'be helpful' },
          { role: 'user', content: 'ok' }
        ]
      });
      expect(next.messages).toHaveLength(2);
      expect(next.messages[0]?.role).toBe('system');
    });
  });

  describe('truncateMessages', () => {
    it('keeps the first N messages', () => {
      const state = freshState();
      const withMsgs = reduceSessionState(state, {
        type: 'replaceMessages',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
          { role: 'user', content: 'c' }
        ]
      });
      const next = reduceSessionState(withMsgs, {
        type: 'truncateMessages',
        keepCount: 2
      });
      expect(next.messages).toHaveLength(2);
      expect(next.messages[0]?.content).toBe('sys');
      expect(next.messages[1]?.content).toBe('a');
    });
  });

  // ---- Tool calls ---------------------------------------------------------
  describe('addToolCall', () => {
    it('adds a tool call to the queue', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'addToolCall',
        toolCall: { id: 'tc_1', name: 'read_file', input: {}, status: 'pending' }
      });
      expect(next.toolCallQueue).toHaveLength(1);
      expect(next.toolCallQueue[0]?.name).toBe('read_file');
    });
  });

  describe('updateToolCall', () => {
    it('updates a tool call by id', () => {
      const state = freshState();
      const withTc = reduceSessionState(state, {
        type: 'addToolCall',
        toolCall: { id: 'tc_1', name: 'read_file', input: {}, status: 'pending' }
      });
      const next = reduceSessionState(withTc, {
        type: 'updateToolCall',
        id: 'tc_1',
        updates: { status: 'running' }
      });
      expect(next.toolCallQueue[0]?.status).toBe('running');
    });

    it('does not affect other tool calls', () => {
      const state = freshState();
      const withBoth = reduceSessionState(
        reduceSessionState(state, {
          type: 'addToolCall',
          toolCall: { id: 'tc_1', name: 'a', input: {}, status: 'pending' }
        }),
        {
          type: 'addToolCall',
          toolCall: { id: 'tc_2', name: 'b', input: {}, status: 'pending' }
        }
      );
      const next = reduceSessionState(withBoth, {
        type: 'updateToolCall',
        id: 'tc_1',
        updates: { status: 'completed' }
      });
      expect(next.toolCallQueue[0]?.status).toBe('completed');
      expect(next.toolCallQueue[1]?.status).toBe('pending');
    });
  });

  // ---- Checkpoints --------------------------------------------------------
  describe('addCheckpoint', () => {
    it('adds a checkpoint', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'addCheckpoint',
        checkpoint: {
          id: 'cp_1',
          createdAt: Date.now(),
          messageCount: 0,
          toolCallCount: 0,
          threadId: 'thread_1'
        }
      });
      expect(next.checkpoints).toHaveLength(1);
      expect(next.checkpoints[0]?.id).toBe('cp_1');
    });
  });

  // ---- Meta ---------------------------------------------------------------
  describe('setMeta', () => {
    it('sets a meta key', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'setMeta',
        key: 'model',
        value: 'claude-4'
      });
      expect(next.meta.model).toBe('claude-4');
    });

    it('preserves existing meta keys', () => {
      const state = freshState();
      const withOne = reduceSessionState(state, {
        type: 'setMeta',
        key: 'model',
        value: 'gpt-4'
      });
      const withTwo = reduceSessionState(withOne, {
        type: 'setMeta',
        key: 'temperature',
        value: 0.7
      });
      expect(withTwo.meta.model).toBe('gpt-4');
      expect(withTwo.meta.temperature).toBe(0.7);
    });
  });

  // ---- Pins ---------------------------------------------------------------
  describe('pinMessage / unpinMessage', () => {
    it('pins a message id', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'pinMessage',
        messageId: 'msg_1'
      });
      expect(next.pinnedMessageIds).toEqual(['msg_1']);
    });

    it('does not duplicate pins', () => {
      const state = freshState();
      const one = reduceSessionState(state, { type: 'pinMessage', messageId: 'msg_1' });
      const two = reduceSessionState(one, { type: 'pinMessage', messageId: 'msg_1' });
      expect(two.pinnedMessageIds).toEqual(['msg_1']);
    });

    it('unpins a message id', () => {
      const state = freshState();
      const withPin = reduceSessionState(state, { type: 'pinMessage', messageId: 'msg_1' });
      const next = reduceSessionState(withPin, { type: 'unpinMessage', messageId: 'msg_1' });
      expect(next.pinnedMessageIds).toEqual([]);
    });
  });

  // ---- Branching ----------------------------------------------------------
  describe('forkSession', () => {
    it('creates a forked state with parent references', () => {
      const state = freshState();
      const next = reduceSessionState(state, {
        type: 'forkSession',
        newSessionId: 'session_2',
        newThreadId: 'thread_2',
        branchMeta: {
          parentSessionId: 'session_1',
          parentThreadId: 'thread_1',
          forkReason: 'exploration'
        }
      });
      expect(next.sessionId).toBe('session_2');
      expect(next.threadId).toBe('thread_2');
      expect(next.parentSessionId).toBe('session_1');
      expect(next.parentThreadId).toBe('thread_1');
      expect(next.branchMeta?.forkReason).toBe('exploration');
    });

    it('preserves messages from the parent', () => {
      const state = freshState();
      const withMsg = reduceSessionState(state, {
        type: 'appendMessage',
        message: { role: 'user', content: 'hello' }
      });
      const forked = reduceSessionState(withMsg, {
        type: 'forkSession',
        newSessionId: 'session_2',
        newThreadId: 'thread_2',
        branchMeta: {
          parentSessionId: 'session_1',
          parentThreadId: 'thread_1'
        }
      });
      expect(forked.messages).toHaveLength(1);
      expect(forked.messages[0]?.content).toBe('hello');
    });
  });

  // ---- Immutability -------------------------------------------------------
  describe('immutability', () => {
    it('never mutates the original state', () => {
      const state = freshState();
      const origCreatedAt = state.createdAt;

      reduceSessionState(state, {
        type: 'appendMessage',
        message: { role: 'user', content: 'test' }
      });
      reduceSessionState(state, {
        type: 'setMeta',
        key: 'model',
        value: 'gpt-4'
      });
      reduceSessionState(state, {
        type: 'addToolCall',
        toolCall: { id: 'tc_1', name: 'x', input: {}, status: 'pending' }
      });

      expect(state.messages).toHaveLength(0);
      expect(Object.keys(state.meta)).toHaveLength(0);
      expect(state.toolCallQueue).toHaveLength(0);
      expect(state.createdAt).toBe(origCreatedAt);
    });
  });
});
