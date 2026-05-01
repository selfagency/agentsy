/**
 * AG-UI Stream Adapter Tests
 *
 * Verifies that PipelineEvent streams are correctly translated to AG-UI events,
 * including proper event sequencing, lifecycle wrapping, and state tracking.
 */

import { describe, expect, it } from 'vitest';
import { toAgUiStream, type PipelineEvent } from './adapter.js';
import { EventType } from './types.js';

/**
 * Helper to consume an async generator into an array
 */
async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

/**
 * Helper to create a simple pipeline event generator
 */
async function* createMockPipeline(events: PipelineEvent[]): AsyncGenerator<PipelineEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('toAgUiStream', () => {
  const runId = 'test_run_123';
  const threadId = 'thread_456';

  it('should wrap stream with RUN_STARTED and RUN_FINISHED', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Hello' },
      { type: 'message_done', usage: { inputTokens: 10, outputTokens: 5 } },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId, threadId }));

    // Should have at least 3 events: RUN_STARTED, TEXT_MESSAGE_CONTENT, RUN_FINISHED
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0]!.type).toBe(EventType.RUN_STARTED);
    expect(events[0]!.runId).toBe(runId);
    expect(events[0]!.threadId).toBe(threadId);

    // Last event should be RUN_FINISHED
    const lastEvent = events[events.length - 1]!;
    expect(lastEvent.type).toBe(EventType.RUN_FINISHED);
    expect(lastEvent.outcome?.type).toBe('success');
  });

  it('should convert delta events to TEXT_MESSAGE_CONTENT', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Hello ' },
      { type: 'delta', content: 'world!' },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Filter for text message events (skip RUN_STARTED/RUN_FINISHED)
    const textEvents = events.filter(e => e.type.includes('text_message'));

    expect(textEvents).toHaveLength(2);
    expect(textEvents[0]!.type).toBe(EventType.TEXT_MESSAGE_CONTENT);
    expect(textEvents[0]!.content).toBe('Hello ');
    expect(textEvents[1]!.type).toBe(EventType.TEXT_MESSAGE_CONTENT);
    expect(textEvents[1]!.content).toBe('world!');
  });

  it('should convert thinking events to REASONING_* sequence', async () => {
    const pipeline = createMockPipeline([
      { type: 'thinking', content: 'Thinking step 1' },
      { type: 'thinking', content: 'Thinking step 2' },
      { type: 'delta', content: 'Answer' },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Find reasoning events
    const reasoningEvents = events.filter(e => e.type.includes('reasoning'));

    // Should have: START, MESSAGE_START, CONTENT (x2), MESSAGE_END, END
    expect(reasoningEvents.length).toBeGreaterThanOrEqual(4);

    // Check sequence
    expect(reasoningEvents[0]!.type).toBe(EventType.REASONING_START);
    expect(reasoningEvents[1]!.type).toBe(EventType.REASONING_MESSAGE_START);

    // Content events should be consecutive
    const contentEvents = reasoningEvents.filter(e => e.type === EventType.REASONING_MESSAGE_CONTENT);
    expect(contentEvents.length).toBe(2);
    expect(contentEvents[0]!.content).toBe('Thinking step 1');
    expect(contentEvents[1]!.content).toBe('Thinking step 2');

    // Should end with MESSAGE_END and REASONING_END
    expect(reasoningEvents[reasoningEvents.length - 2]!.type).toBe(EventType.REASONING_MESSAGE_END);
    expect(reasoningEvents[reasoningEvents.length - 1]!.type).toBe(EventType.REASONING_END);
  });

  it('should convert tool_call events to TOOL_CALL_* sequence', async () => {
    const pipeline = createMockPipeline([
      {
        type: 'tool_call',
        toolCallId: 'call_123',
        toolName: 'search',
        toolArgs: { query: 'AI trends' },
      },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Find tool call events
    const toolEvents = events.filter(e => e.type.includes('tool_call'));

    expect(toolEvents.length).toBeGreaterThanOrEqual(3);
    expect(toolEvents[0]!.type).toBe(EventType.TOOL_CALL_START);
    expect(toolEvents[0]!.toolName).toBe('search');
    expect(toolEvents[0]!.toolCallId).toBe('call_123');

    expect(toolEvents[1]!.type).toBe(EventType.TOOL_CALL_ARGS);
    expect(toolEvents[1]!.args).toEqual({ query: 'AI trends' });

    expect(toolEvents[2]!.type).toBe(EventType.TOOL_CALL_END);
  });

  it('should handle thinking followed by tool_call', async () => {
    const pipeline = createMockPipeline([
      { type: 'thinking', content: 'Need to search for info' },
      {
        type: 'tool_call',
        toolCallId: 'call_456',
        toolName: 'search',
        toolArgs: { query: 'something' },
      },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Verify reasoning is properly closed before tool call starts
    const reasoningEnd = events.find(e => e.type === EventType.REASONING_END);
    const toolStart = events.find(e => e.type === EventType.TOOL_CALL_START);

    expect(reasoningEnd).toBeDefined();
    expect(toolStart).toBeDefined();

    // Tool call should come after reasoning ends
    const reasoningEndIdx = events.indexOf(reasoningEnd!);
    const toolStartIdx = events.indexOf(toolStart!);
    expect(toolStartIdx).toBeGreaterThan(reasoningEndIdx);
  });

  it('should emit RUN_ERROR on error event', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Starting...' },
      {
        type: 'error',
        message: 'API rate limit exceeded',
        code: 'RATE_LIMIT',
      },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    const errorEvent = events.find(e => e.type === EventType.RUN_ERROR);
    expect(errorEvent).toBeDefined();
    expect((errorEvent as any).error?.message).toBe('API rate limit exceeded');
    expect((errorEvent as any).error?.code).toBe('RATE_LIMIT');
  });

  it('should include usage info in RUN_FINISHED', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Response' },
      {
        type: 'message_done',
        usage: { inputTokens: 100, outputTokens: 50 },
      },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    const finished = events.find(e => e.type === EventType.RUN_FINISHED);
    expect(finished?.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  it('should support parentRunId for hierarchical workflows', async () => {
    const pipeline = createMockPipeline([{ type: 'delta', content: 'Sub-agent response' }, { type: 'message_done' }]);

    const parentRunId = 'parent_run_789';
    const events = await collectEvents(toAgUiStream(pipeline, { runId, parentRunId }));

    const started = events.find(e => e.type === EventType.RUN_STARTED);
    expect(started?.parentRunId).toBe(parentRunId);
  });

  it('should maintain correct messageIds across events', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Part 1 ' },
      { type: 'delta', content: 'Part 2' },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    const textEvents = events.filter(e => e.type.includes('text_message'));

    // All text events should share the same messageId
    const firstMessageId = textEvents[0]?.messageId;
    textEvents.forEach(e => {
      expect(e.messageId).toBe(firstMessageId);
    });
  });

  it('should handle empty delta gracefully', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: '' },
      { type: 'delta', content: 'Real content' },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Should still emit a text event for the real content
    const textEvents = events.filter(e => e.type.includes('text_message'));
    expect(textEvents.some(e => e.content === 'Real content')).toBe(true);
  });

  it('should emit RUN_FINISHED after closing reasoning/tool_call', async () => {
    const pipeline = createMockPipeline([
      { type: 'thinking', content: 'Thinking...' },
      {
        type: 'tool_call',
        toolCallId: 'call_789',
        toolName: 'calculate',
        toolArgs: { expression: '2+2' },
      },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    // Find indices
    const reasoningEndIdx = events.findIndex(e => e.type === EventType.REASONING_END);
    const toolEndIdx = events.findIndex(e => e.type === EventType.TOOL_CALL_END);
    const finishedIdx = events.findIndex(e => e.type === EventType.RUN_FINISHED);

    expect(reasoningEndIdx).toBeGreaterThan(-1);
    expect(toolEndIdx).toBeGreaterThan(-1);
    expect(finishedIdx).toBeGreaterThan(Math.max(reasoningEndIdx, toolEndIdx));
  });

  it('should handle encryption option for reasoning', async () => {
    const pipeline = createMockPipeline([{ type: 'thinking', content: 'Secret thoughts' }, { type: 'message_done' }]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId, encryptReasoning: true }));

    const contentEvent = events.find(e => e.type === EventType.REASONING_MESSAGE_CONTENT);
    expect((contentEvent as any).encryptedValue).toBe('encrypted');
  });

  it('should include timestamps on all events', async () => {
    const pipeline = createMockPipeline([{ type: 'delta', content: 'Hello' }, { type: 'message_done' }]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId }));

    events.forEach(event => {
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(() => new Date(event.timestamp as string)).not.toThrow();
    });
  });

  it('should pass through runId and threadId to all events', async () => {
    const pipeline = createMockPipeline([
      { type: 'delta', content: 'Test' },
      { type: 'thinking', content: 'Think' },
      {
        type: 'tool_call',
        toolCallId: 'call_1',
        toolName: 'test',
        toolArgs: {},
      },
      { type: 'message_done' },
    ]);

    const events = await collectEvents(toAgUiStream(pipeline, { runId, threadId }));

    events.forEach(event => {
      expect(event.runId).toBe(runId);
      expect(event.threadId).toBe(threadId);
    });
  });
});
