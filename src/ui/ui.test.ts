import { describe, expect, it, vi } from 'vitest';
import { applyConversationEvent } from './eventSourcing.js';
import { createConversationStore } from './store.js';
import type { ConversationEvent, UIConversation } from './types.js';
import type { FinishReason } from '../tool-calls/types.js';

describe('UI Event Sourcing', () => {
  describe('applyConversationEvent', () => {
    const initialState: UIConversation = {
      id: 'conv-1',
      messages: [],
      stepIndex: 0,
      lastEventAt: new Date('2025-01-01'),
      totalTokens: 0,
      metadata: undefined,
    };

    it('should add a new message on message_started event', () => {
      const event: ConversationEvent = {
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      };

      const newState = applyConversationEvent(initialState, event);

      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0]?.id).toBe('msg-1');
      expect(newState.messages[0]?.role).toBe('user');
      expect(newState.messages[0]?.parts).toHaveLength(0);
    });

    it('should add text part to message on text_part_added event', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'text_part_added',
        messageId: 'msg-1',
        text: 'Hello, world!',
      });

      expect(state.messages[0]?.parts).toHaveLength(1);
      expect(state.messages[0]?.parts[0]?.type).toBe('text');
      expect(state.messages[0]?.parts[0]?.type === 'text' && state.messages[0]?.parts[0]?.text).toBe('Hello, world!');
    });

    it('should add thinking part to message on thinking_part_added event', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'thinking_part_added',
        messageId: 'msg-1',
        text: 'Let me think about this...',
      });

      expect(state.messages[0]?.parts).toHaveLength(1);
      expect(state.messages[0]?.parts[0]?.type).toBe('thinking');
      expect(state.messages[0]?.parts[0]?.type === 'thinking' && state.messages[0]?.parts[0]?.text).toBe(
        'Let me think about this...',
      );
    });

    it('should add tool call part to message on tool_call_part_added event', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'tool_call_part_added',
        messageId: 'msg-1',
        toolCall: {
          id: 'call-1',
          name: 'search',
          parameters: { query: 'TypeScript best practices' },
        },
      });

      expect(state.messages[0]?.parts).toHaveLength(1);
      const part = state.messages[0]?.parts?.[0];

      // Type guard to narrow type
      if (!part || part.type !== 'tool_call') {
        throw new Error('Expected tool_call part');
      }

      expect(part.name).toBe('search');
      expect(part.parameters).toEqual({ query: 'TypeScript best practices' });
    });

    it('should set finishReason and usage on message_finished event', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'message_finished',
        messageId: 'msg-1',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      expect(state.messages[0]?.finishReason).toBe('stop');
      expect(state.messages[0]?.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
      expect(state.totalTokens).toBe(30);
    });

    it('should accumulate totalTokens across multiple messages', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'message_finished',
        messageId: 'msg-1',
        usage: { totalTokens: 30 },
      });

      state = applyConversationEvent(state, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-2',
      });

      state = applyConversationEvent(state, {
        type: 'message_finished',
        messageId: 'msg-2',
        usage: { totalTokens: 20 },
      });

      expect(state.totalTokens).toBe(50);
    });

    it('should update stepIndex on step_updated event', () => {
      const event: ConversationEvent = {
        type: 'step_updated',
        stepIndex: 3,
      };

      const newState = applyConversationEvent(initialState, event);

      expect(newState.stepIndex).toBe(3);
    });

    it('should reset conversation on conversation_reset event', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'text_part_added',
        messageId: 'msg-1',
        text: 'Hello',
      });

      expect(state.messages).toHaveLength(1);

      state = applyConversationEvent(state, {
        type: 'conversation_reset',
      });

      expect(state.messages).toHaveLength(0);
      expect(state.stepIndex).toBe(0);
      expect(state.totalTokens).toBe(0);
    });

    it('should never mutate original state', () => {
      const originalState = JSON.stringify(initialState);

      applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      expect(JSON.stringify(initialState)).toBe(originalState);
    });

    it('should build complex multi-part message', () => {
      let state = applyConversationEvent(initialState, {
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-1',
      });

      state = applyConversationEvent(state, {
        type: 'thinking_part_added',
        messageId: 'msg-1',
        text: 'Processing request...',
      });

      state = applyConversationEvent(state, {
        type: 'text_part_added',
        messageId: 'msg-1',
        text: 'I found something relevant.',
      });

      state = applyConversationEvent(state, {
        type: 'tool_call_part_added',
        messageId: 'msg-1',
        toolCall: {
          id: 'call-1',
          name: 'verify',
          parameters: { data: 'test' },
        },
      });

      state = applyConversationEvent(state, {
        type: 'message_finished',
        messageId: 'msg-1',
        finishReason: 'tool-calls',
        usage: { totalTokens: 100 },
      });

      expect(state.messages[0]?.parts).toHaveLength(3);
      expect(state.messages[0]?.finishReason).toBe('tool-calls');
      expect(state.totalTokens).toBe(100);
    });
  });

  describe('ConversationStore', () => {
    function startMessage(
      store: ReturnType<typeof createConversationStore>,
      role: 'user' | 'assistant',
      messageId: string,
    ): void {
      store.dispatch({ type: 'message_started', role, messageId });
    }

    function addTextPart(store: ReturnType<typeof createConversationStore>, messageId: string, text: string): void {
      store.dispatch({ type: 'text_part_added', messageId, text });
    }

    function addThinkingPart(store: ReturnType<typeof createConversationStore>, messageId: string, text: string): void {
      store.dispatch({ type: 'thinking_part_added', messageId, text });
    }

    function addToolCallPart(
      store: ReturnType<typeof createConversationStore>,
      messageId: string,
      toolCall: { id: string; name: string; parameters: Record<string, unknown> },
    ): void {
      store.dispatch({ type: 'tool_call_part_added', messageId, toolCall });
    }

    function finishMessage(
      store: ReturnType<typeof createConversationStore>,
      messageId: string,
      finishReason?: FinishReason,
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number },
    ): void {
      if (finishReason && usage) {
        store.dispatch({ type: 'message_finished', messageId, finishReason, usage });
      } else if (finishReason) {
        store.dispatch({ type: 'message_finished', messageId, finishReason });
      } else {
        store.dispatch({ type: 'message_finished', messageId });
      }
    }
    it('should initialize with empty state', () => {
      const store = createConversationStore('conv-1');
      const state = store.getState();

      expect(state.id).toBe('conv-1');
      expect(state.messages).toHaveLength(0);
      expect(state.stepIndex).toBe(0);
      expect(state.totalTokens).toBe(0);
    });

    it('should dispatch events and update state', () => {
      const store = createConversationStore('conv-1');

      store.dispatch({
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      const state = store.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]?.id).toBe('msg-1');
    });

    it('should notify listeners on dispatch', () => {
      const store = createConversationStore('conv-1');
      const listener = vi.fn();

      store.subscribe(listener);

      store.dispatch({
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0].messages).toHaveLength(1);
    });

    it('should unsubscribe listener', () => {
      const store = createConversationStore('conv-1');
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);

      store.dispatch({
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.dispatch({
        type: 'message_started',
        role: 'assistant',
        messageId: 'msg-2',
      });

      expect(listener).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should track event log for audit trail', () => {
      const store = createConversationStore('conv-1');

      const event1: ConversationEvent = {
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      };

      const event2: ConversationEvent = {
        type: 'text_part_added',
        messageId: 'msg-1',
        text: 'Hello',
      };

      store.dispatch(event1);
      store.dispatch(event2);

      const eventLog = store.getEventLog();
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0]).toEqual(event1);
      expect(eventLog[1]).toEqual(event2);
    });

    it('should return shallow copy of state to prevent mutations', () => {
      const store = createConversationStore('conv-1');

      store.dispatch({
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      const state1 = store.getState();
      const state2 = store.getState();

      // Should be different objects
      expect(state1).not.toBe(state2);
      expect(state1.messages).not.toBe(state2.messages);

      // But have same content
      expect(state1).toEqual(state2);
    });

    it('should support multiple subscribers', () => {
      const store = createConversationStore('conv-1');
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.dispatch({
        type: 'message_started',
        role: 'user',
        messageId: 'msg-1',
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle complex conversation flow', () => {
      const store = createConversationStore('conv-1');

      // User message
      startMessage(store, 'user', 'msg-1');
      addTextPart(store, 'msg-1', 'What is TypeScript?');
      finishMessage(store, 'msg-1');

      // Assistant message with thinking, text, and tool call
      startMessage(store, 'assistant', 'msg-2');
      addThinkingPart(store, 'msg-2', 'The user is asking about TypeScript...');
      addTextPart(store, 'msg-2', 'TypeScript is a typed superset of JavaScript.');
      addToolCallPart(store, 'msg-2', {
        id: 'call-1',
        name: 'search_docs',
        parameters: { query: 'TypeScript documentation' },
      });
      finishMessage(store, 'msg-2', 'tool-calls', { inputTokens: 20, outputTokens: 50, totalTokens: 70 });

      const state = store.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1]?.parts).toHaveLength(3); // thinking, text, tool_call
      expect(state.totalTokens).toBe(70);
      expect(state.messages[1]?.finishReason).toBe('tool-calls');
    });
  });
});
