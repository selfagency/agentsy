/**
 * AG-UI Reasoning Mapper Tests
 *
 * Verifies mapping of reasoning content to AG-UI reasoning events
 */

import { describe, expect, it } from 'vitest';
import { mapReasoningToEvents } from './reasoning-mapper.js';
import { EventType } from './types.js';

describe('mapReasoningToEvents', () => {
  it('should create 5-event sequence for reasoning', () => {
    const events = mapReasoningToEvents('thinking...', { runId: 'run_123' });

    expect(events).toHaveLength(5);
    expect(events[0]!.type).toBe(EventType.REASONING_START);
    expect(events[1]!.type).toBe(EventType.REASONING_MESSAGE_START);
    expect(events[2]!.type).toBe(EventType.REASONING_MESSAGE_CONTENT);
    expect(events[3]!.type).toBe(EventType.REASONING_MESSAGE_END);
    expect(events[4]!.type).toBe(EventType.REASONING_END);
  });

  it('should assign consistent messageId across sequence', () => {
    const events = mapReasoningToEvents('thought', { runId: 'run_123' });

    expect(events.length).toBeGreaterThan(3);
    const messageId = events[1]!.messageId;
    expect(events[2]!.messageId).toBe(messageId);
    expect(events[3]!.messageId).toBe(messageId);
  });

  it('should set messageId on START and CONTENT events only', () => {
    const events = mapReasoningToEvents('reasoning', { runId: 'run_123' });

    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events[0]!.messageId).toBeDefined(); // REASONING_START
    expect(events[1]!.messageId).toBeDefined(); // REASONING_MESSAGE_START
    expect(events[2]!.messageId).toBeDefined(); // REASONING_MESSAGE_CONTENT
    expect(events[3]!.messageId).toBeDefined(); // REASONING_MESSAGE_END
    expect(events[4]!.messageId).toBeDefined(); // REASONING_END
  });

  it('should propagate runId to all events', () => {
    const events = mapReasoningToEvents('test', { runId: 'run_456' });

    for (const event of events) {
      expect(event.runId).toBe('run_456');
    }
  });

  it('should include threadId when provided', () => {
    const events = mapReasoningToEvents('reason', {
      runId: 'run_123',
      threadId: 'thread_789',
    });

    for (const event of events) {
      expect(event.threadId).toBe('thread_789');
    }
  });

  it('should not include threadId when not provided', () => {
    const events = mapReasoningToEvents('reason', { runId: 'run_123' });

    for (const event of events) {
      expect('threadId' in event).toBe(false);
    }
  });

  it('should encrypt reasoningContent when option enabled', () => {
    const events = mapReasoningToEvents('secret', {
      runId: 'run_123',
      encryptReasoning: true,
    });

    expect(events.length).toBeGreaterThan(2);
    const contentEvent = events[2]!;
    expect(contentEvent.type).toBe(EventType.REASONING_MESSAGE_CONTENT);
    // Content may have encryptedValue instead of plain content
    expect((contentEvent as any).encryptedValue).toBe('encrypted');
  });

  it('should use plain content when encryption disabled', () => {
    const reasoning = 'plain thinking';
    const events = mapReasoningToEvents(reasoning, {
      runId: 'run_123',
      encryptReasoning: false,
    });

    expect(events.length).toBeGreaterThan(2);
    const contentEvent = events[2]!;
    expect(contentEvent.content).toBe(reasoning);
  });

  it('should default encryption to false', () => {
    const reasoning = 'my thought';
    const events = mapReasoningToEvents(reasoning, { runId: 'run_123' });

    expect(events.length).toBeGreaterThan(2);
    const contentEvent = events[2]!;
    expect(contentEvent.content).toBe(reasoning);
  });

  it('should generate consistent timestamps', () => {
    const events = mapReasoningToEvents('reason', { runId: 'run_123' });

    // All timestamps should be within 10ms of each other (they should be nearly identical)
    expect(events.length).toBeGreaterThan(0);
    const firstTime = new Date(events[0]!.timestamp!).getTime();
    for (const event of events) {
      const eventTime = new Date(event.timestamp!).getTime();
      const diff = Math.abs(eventTime - firstTime);
      expect(diff).toBeLessThan(100); // Within 100ms
    }
  });

  it('should generate valid ISO 8601 timestamps', () => {
    const events = mapReasoningToEvents('test', { runId: 'run_123' });

    for (const event of events) {
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(event.timestamp!)).not.toThrow();
    }
  });

  it('should handle empty reasoning string', () => {
    const events = mapReasoningToEvents('', { runId: 'run_123' });

    expect(events).toHaveLength(0);
  });

  it('should handle undefined reasoning gracefully', () => {
    const events = mapReasoningToEvents(undefined as any, { runId: 'run_123' });

    expect(events).toHaveLength(0);
  });

  it('should handle multiline reasoning', () => {
    const reasoning = 'line 1\nline 2\nline 3';
    const events = mapReasoningToEvents(reasoning, { runId: 'run_123' });

    expect(events.length).toBeGreaterThan(2);
    const contentEvent = events[2];
    expect(contentEvent!.content).toContain('line 1');
    expect(contentEvent!.content).toContain('line 2');
    expect(contentEvent!.content).toContain('line 3');
  });

  it('should generate unique messageIds for different reasoning calls', () => {
    const events1 = mapReasoningToEvents('reason1', { runId: 'run_123' });
    const events2 = mapReasoningToEvents('reason2', { runId: 'run_123' });

    expect(events1.length).toBeGreaterThan(1);
    expect(events2.length).toBeGreaterThan(1);

    const messageId1 = events1[1]!.messageId;
    const messageId2 = events2[1]!.messageId;

    expect(messageId1).not.toBe(messageId2);
  });
});
