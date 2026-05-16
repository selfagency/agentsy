/**
 * AG-UI Event Converters Tests
 *
 * Verifies conversion to CopilotKit and custom UI event formats
 */

import type {
  ReasoningMessageContentEvent,
  RunErrorEvent,
  RunFinishedEvent,
  RunStartedEvent,
  StepFinishedEvent,
  StepStartedEvent,
  TextMessageContentEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallStartEvent
} from '@agentsy/types';
import { EventType } from '@agentsy/types';
import { describe, expect, it } from 'vitest';
import {
  convertEventStream,
  createEventConverter,
  toCopilotKitEvent,
  toCustomUIEvent,
  type CopilotKitEvent,
  type CustomUIEvent
} from './event-converters.js';

// Test fixtures
async function createMockStream() {
  const events: RunStartedEvent[] = [
    {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z'
    },
    {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:01Z'
    }
  ];

  async function* generate() {
    for (const event of events) {
      yield event;
    }
  }

  return generate();
}

async function* multiEventGenerator() {
  const events: RunStartedEvent[] = [
    {
      type: EventType.RUN_STARTED,
      runId: 'run_a',
      timestamp: '2024-01-01T00:00:00Z'
    },
    {
      type: EventType.RUN_STARTED,
      runId: 'run_b',
      timestamp: '2024-01-01T00:00:01Z'
    },
    {
      type: EventType.RUN_STARTED,
      runId: 'run_c',
      timestamp: '2024-01-01T00:00:02Z'
    }
  ];
  for (const event of events) {
    yield event;
  }
}

describe('toCopilotKitEvent', () => {
  it('should convert RUN_STARTED to runStarted', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCopilotKitEvent(event);

    expect(result.type).toBe('tool_call:start');
    expect(result.toolCallId).toBe('call_123');
    expect(result.toolName).toBe('search');
  });

  it('should fallback to original type if not in mapping', () => {
    const unknownEvent = {
      type: 'EXTREMELY_UNKNOWN_TYPE',
      payload: 'data'
    };
    const result = toCopilotKitEvent(unknownEvent as unknown as RunStartedEvent);
    expect(result.type).toBe('EXTREMELY_UNKNOWN_TYPE');
  });

  it('should default to "unknown" if type is missing', () => {
    const missingTypeEvent = {
      payload: 'data'
    };
    const result = toCopilotKitEvent(missingTypeEvent as unknown as RunStartedEvent);
    expect(result.type).toBe('unknown');
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
      { eventType: EventType.TOOL_CALL_END, expected: 'tool_call:end' }
    ];

    for (const { eventType, expected } of testCases) {
      const event: Record<string, unknown> = {
        type: eventType,
        runId: 'run_123',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const result = toCopilotKitEvent(event as unknown as RunStartedEvent);
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
      threadId: 'thread_456'
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
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.toolCallId).toBe('call_123');
    expect(result.payload.toolName).toBe('search');
  });

  it('should build payload for REASONING_MESSAGE_CONTENT', () => {
    const event: ReasoningMessageContentEvent = {
      type: EventType.REASONING_MESSAGE_CONTENT,
      runId: 'run_123',
      messageId: 'msg_123',
      content: 'Thinking...',
      timestamp: '2024-01-01T00:00:00Z',
      encryptedValue: 'secret'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.messageId).toBe('msg_123');
    expect(result.payload.content).toBe('Thinking...');
    expect(result.payload.encrypted).toBe(true);
  });

  it('should build payload for TOOL_CALL_ARGS', () => {
    const event: ToolCallArgsEvent = {
      type: EventType.TOOL_CALL_ARGS,
      runId: 'run_123',
      toolCallId: 'call_123',
      args: '{"query": "test"}',
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.toolCallId).toBe('call_123');
    expect(result.payload.args).toBe('{"query": "test"}');
  });

  it('should build payload for TOOL_CALL_END', () => {
    const event: ToolCallEndEvent = {
      type: EventType.TOOL_CALL_END,
      runId: 'run_123',
      toolCallId: 'call_123',
      output: 'Success',
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.toolCallId).toBe('call_123');
    expect(result.payload.output).toBe('Success');
  });

  it('should build payload for RUN_FINISHED', () => {
    const event: RunFinishedEvent = {
      type: EventType.RUN_FINISHED,
      runId: 'run_123',
      outcome: { type: 'success' },
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.outcome).toEqual({ type: 'success' });
  });

  it('should build payload for RUN_ERROR', () => {
    const event: RunErrorEvent = {
      type: EventType.RUN_ERROR,
      runId: 'run_123',
      error: { message: 'Something went wrong' },
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.error).toEqual({ message: 'Something went wrong' });
  });

  it('should build payload for STEP_STARTED', () => {
    const event: StepStartedEvent = {
      type: EventType.STEP_STARTED,
      runId: 'run_123',
      stepIndex: 1,
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.stepIndex).toBe(1);
  });

  it('should build payload for STEP_FINISHED', () => {
    const event: StepFinishedEvent = {
      type: EventType.STEP_FINISHED,
      runId: 'run_123',
      stepIndex: 1,
      outputLength: 100,
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = toCustomUIEvent(event);

    expect(result.payload.stepIndex).toBe(1);
    expect(result.payload.outputLength).toBe(100);
  });

  it('should handle unmapped event types via default case', () => {
    const unknownEvent = {
      type: 'UNKNOWN_EVENT_TYPE',
      runId: 'run_123',
      foo: 'bar',
      timestamp: '2024-01-01T00:00:00Z'
    };
    const result = toCustomUIEvent(unknownEvent as unknown as RunStartedEvent);
    expect(result.eventType).toBe('UNKNOWN_EVENT_TYPE');
    expect(result.payload['foo']).toBe('bar');
  });

  it('should not include undefined threadId', () => {
    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z'
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
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = converter(event);

    expect((result as Record<string, unknown>).type).toBe('run:started');
  });

  it('should create custom converter', () => {
    const converter = createEventConverter('custom');

    const event: RunStartedEvent = {
      type: EventType.RUN_STARTED,
      runId: 'run_123',
      timestamp: '2024-01-01T00:00:00Z'
    };

    const result = converter(event);

    expect(result.eventType).toBe(EventType.RUN_STARTED);
  });

  it('should throw on unknown format', () => {
    expect(() => {
      createEventConverter('unknown' as unknown as 'copilot-kit' | 'custom');
    }).toThrow(/Unknown format/);
  });

  it('should return converter function', () => {
    const converter = createEventConverter('copilot-kit');

    expect(typeof converter).toBe('function');
  });
});

describe('convertEventStream', () => {
  it('should convert stream to copilot-kit format', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'copilot-kit');

    const results = [];
    for await (const event of converted) {
      results.push(event);
    }

    expect(results).toHaveLength(2);
    const firstEvent = results[0];
    expect(firstEvent).toBeDefined();
    expect((firstEvent as Record<string, unknown>).type).toBe('run:started');
  });

  it('should convert stream to custom format', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'custom');

    const results: (CopilotKitEvent | CustomUIEvent)[] = [];
    for await (const event of converted) {
      results.push(event);
    }

    expect(results).toHaveLength(2);
    const firstEvent = results[0];
    expect(firstEvent).toBeDefined();
    if (!firstEvent) return;
    expect((firstEvent as CustomUIEvent).eventType).toBe(EventType.RUN_STARTED);
  });

  it('should return async generator', async () => {
    const source = await createMockStream();
    const converted = convertEventStream(source, 'copilot-kit');

    expect(typeof converted[Symbol.asyncIterator]).toBe('function');
  });

  it('should handle multiple event orders distinctly', async () => {
    const converted = convertEventStream(multiEventGenerator(), 'custom');

    const results: (CopilotKitEvent | CustomUIEvent)[] = [];
    for await (const event of converted) {
      results.push(event);
    }

    expect(results).toHaveLength(3);
    const first = results[0];
    const second = results[1];
    const third = results[2];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(third).toBeDefined();
    if (!first || !second || !third) return;
    expect((first as CustomUIEvent).runId).toBe('run_a');
    expect((second as CustomUIEvent).runId).toBe('run_b');
    expect((third as CustomUIEvent).runId).toBe('run_c');
  });
});
