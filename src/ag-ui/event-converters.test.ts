/**
 * AG-UI Event Converters Tests
 *
 * Verifies conversion to CopilotKit and custom UI event formats
 */

import { describe, expect, it } from 'vitest';
import {
  convertEventStream,
  createEventConverter,
  toCopilotKitEvent,
  toCustomUIEvent,
  type CopilotKitEvent,
} from './event-converters.js';
import { EventType, type RunStartedEvent, type TextMessageContentEvent, type ToolCallStartEvent } from './types.js';

describe('toCopilotKitEvent', () => {
  it('should convert RUN_STARTED to runStarted', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCopilotKitEvent(event);

    expect(result.type).toBe('run:started');
    expect(result.runId).toBe('run_123');
  });

  it('should convert TEXT_MESSAGE_CONTENT to text_message:content', () => {
    const event: TextMessageContentEvent = {
      type: EventType.TEXT_MESSAGE_CONTENT,
      runId: 'run_123',
      messageId: 'msg_123',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCopilotKitEvent(event);

    expect(result.type).toBe('text_message:content');
    expect(result.messageId).toBe('msg_123');
    expect(result.content).toBe('Hello');
  });

  it('should convert TOOL_CALL_START to tool_call:start', () => {
    const event: ToolCallStartEvent = {
      type: EventType.TOOL_CALL_START,
      runId: 'run_123',
      toolCallId: 'call_123',
      toolName: 'search',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCopilotKitEvent(event);

    expect(result.type).toBe('tool_call:start');
    expect(result.toolCallId).toBe('call_123');
    expect(result.toolName).toBe('search');
  });

  it('should convert all event types to their mapped values', () => {
    const testCases = [
      { eventType: EventType.RUN_STARTED, expected: 'run:started' },
      { eventType: EventType.RUN_FINISHED, expected: 'run:finished' },
      { eventType: EventType.RUN_ERROR, expected: 'run:error' },
      { eventType: EventType.STEP_STARTED, expected: 'step:started' },
      { eventType: EventType.STEP_FINISHED, expected: 'step:finished' },
      { eventType: EventType.TEXT_MESSAGE_CONTENT, expected: 'text_message:content' },
      { eventType: EventType.REASONING_MESSAGE_CONTENT, expected: 'reasoning_message:content' },
      { eventType: EventType.TOOL_CALL_START, expected: 'tool_call:start' },
      { eventType: EventType.TOOL_CALL_ARGS, expected: 'tool_call:args' },
      { eventType: EventType.TOOL_CALL_END, expected: 'tool_call:end' },
    ];

    for (const { eventType, expected } of testCases) {
      const event: any = {
        type: eventType,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = toCopilotKitEvent(event);
      expect(result.type).toBe(expected);
    }
  });

  it('should preserve all event properties', () => {
    const event: TextMessageContentEvent = {
      type: EventType.TEXT_MESSAGE_CONTENT,
      runId: 'run_123',
      messageId: 'msg_123',
      content: 'Test content',
      timestamp: '2024-01-01T00:00:00Z',
      threadId: 'thread_456',
    };

    const result = toCopilotKitEvent(event);

    expect(result.runId).toBe('run_123');
    expect(result.messageId).toBe('msg_123');
    expect(result.content).toBe('Test content');
    expect(result.threadId).toBe('thread_456');
  });
});

describe('toCustomUIEvent', () => {
  it('should create custom event with common fields', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCustomUIEvent(event);

    expect(result.eventType).toBe(EventType.RUN_STARTED);
    expect(result.runId).toBe('run_123');
    expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
  });

  it('should include threadId in custom event', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      threadId: 'thread_456',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCustomUIEvent(event);

    expect(result.threadId).toBe('thread_456');
  });

  it('should build payload for TEXT_MESSAGE_CONTENT', () => {
    const event: TextMessageContentEvent = {
      type: EventType.TEXT_MESSAGE_CONTENT,
      runId: 'run_123',
      messageId: 'msg_123',
      content: 'Hello world',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.messageId).toBe('msg_123');
    expect(result.payload.content).toBe('Hello world');
  });

  it('should build payload for TOOL_CALL_START', () => {
    const event: ToolCallStartEvent = {
      type: EventType.TOOL_CALL_START,
      runId: 'run_123',
      toolCallId: 'call_123',
      toolName: 'search',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.toolCallId).toBe('call_123');
    expect(result.payload.toolName).toBe('search');
  });

  it('should not include undefined threadId', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = toCustomUIEvent(event);

    expect('threadId' in result).toBe(false);
  });
});

describe('createEventConverter', () => {
  it('should create copilot-kit converter', () => {
    const converter = createEventConverter('copilot-kit');

    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = converter(event);

    expect((result as any).type).toBe('run:started');
  });

  it('should create custom converter', () => {
    const converter = createEventConverter('custom');

    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = converter(event);

    expect(result.eventType).toBe(EventType.RUN_STARTED);
  });

  it('should throw on unknown format', () => {
    expect(() => {
      createEventConverter('unknown' as any);
    }).toThrow(/Unknown format/);
  });

  it('should return converter function', () => {
    const converter = createEventConverter('copilot-kit');

    expect(typeof converter).toBe('function');
  });
});

describe('convertEventStream', () => {
  async function createMockStream() {
    const events: RunStartedEvent[] = [
      {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: EventType.RUN_STARTED,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:01Z',
      },
    ];

    async function* generate() {
      for (const event of events) {
        yield event;
      }
    }

    return generate();
  }

  it('should convert stream to copilot-kit format', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'copilot-kit');

    const results = [];
    for await (const event of converted) {
      results.push(event);
    }

    expect(results).toHaveLength(2);
    expect((results[0]! as any).type).toBe('run:started');
  });

  it('should convert stream to custom format', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'custom');

    const results = [];
    for await (const event of converted) {
      results.push(event);
    }

    expect(results).toHaveLength(2);
    expect(results[0]!.eventType).toBe(EventType.RUN_STARTED);
  });

  it('should return async generator', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'copilot-kit');

    expect(typeof converted[Symbol.asyncIterator]).toBe('function');
  });

  it('should preserve event order', async () => {
    const events: RunStartedEvent[] = [
      {
        type: EventType.RUN_STARTED,
        runId: 'run_1',
        timestamp: '2024-01-01T00:00:00Z',
      },
      {
        type: EventType.RUN_STARTED,
        runId: 'run_2',
        timestamp: '2024-01-01T00:00:01Z',
      },
      {
        type: EventType.RUN_STARTED,
        runId: 'run_3',
        timestamp: '2024-01-01T00:00:02Z',
      },
    ];

    async function* mockSource() {
      for (const event of events) {
        yield event;
      }
    }

    const converted = convertEventStream(mockSource(), 'copilot-kit');

    const results = [];
    for await (const event of converted) {
      results.push(event as CopilotKitEvent);
    }

    expect(results).toHaveLength(3);
    expect(results[0]!.runId).toBe('run_1');
    expect(results[1]!.runId).toBe('run_2');
    expect(results[2]!.runId).toBe('run_3');
  });
});
