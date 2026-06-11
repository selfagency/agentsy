import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './message-scrubbing.js';
import { scrubMessage, scrubMessagesDetailed, scrubMessagesForModel } from './message-scrubbing.js';
import type { GuardrailResult, GuardrailScanner } from './types.js';

// =============================================================================
// Helpers
// =============================================================================

class NoopScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/test-noop',
    name: 'No-op Scanner',
    version: '1.0.0',
    description: 'Test scanner that passes everything',
    priority: 99,
    owaspCategories: [] as never[],
    tags: ['test']
  };

  evaluate(_input: string): Promise<GuardrailResult> {
    return Promise.resolve({ status: 'pass', phase: 'input' });
  }
}

class RedactEmailScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/test-redact',
    name: 'Redact Email Scanner',
    version: '1.0.0',
    description: 'Test scanner that redacts emails',
    priority: 98,
    owaspCategories: [] as never[],
    tags: ['test']
  };

  evaluate(input: string): Promise<GuardrailResult> {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const sanitized = input.replace(emailPattern, '[REDACTED-EMAIL]');

    if (sanitized !== input) {
      return Promise.resolve({
        status: 'transform',
        phase: 'input',
        sanitized,
        detections: [{ id: 'email', description: 'PII detected: email', severity: 'medium' }]
      });
    }

    return Promise.resolve({ status: 'pass', phase: 'input' });
  }
}

class BlockScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/test-block',
    name: 'Block Scanner',
    version: '1.0.0',
    description: 'Test scanner that always blocks',
    priority: 97,
    owaspCategories: [] as never[],
    tags: ['test']
  };

  evaluate(input: string): Promise<GuardrailResult> {
    if (input.includes('BLOCK_ME')) {
      return Promise.resolve({
        status: 'block',
        phase: 'input',
        reason: 'Blocked by test scanner',
        detections: [{ id: 'test-block', description: 'Test block', severity: 'high' }]
      });
    }
    return Promise.resolve({ status: 'pass', phase: 'input' });
  }
}

class ErrorScanner implements GuardrailScanner {
  readonly metadata = {
    id: 'hub://guardrails/test-error',
    name: 'Error Scanner',
    version: '1.0.0',
    description: 'Test scanner that throws',
    priority: 96,
    owaspCategories: [] as never[],
    tags: ['test']
  };

  evaluate(_input: string): Promise<GuardrailResult> {
    throw new Error('Scanner error');
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('scrubMessage', () => {
  it('passes non-user messages through unchanged', async () => {
    const systemMsg: ChatMessage = { role: 'system', content: 'You are a helpful assistant.' };
    const result = await scrubMessage(systemMsg, [new RedactEmailScanner()]);
    expect(result.message.scrubbed).toBe(false);
    expect(result.message.content).toBe('You are a helpful assistant.');
    expect(result.detections).toHaveLength(0);
  });

  it('passes assistant messages through unchanged', async () => {
    const assistantMsg: ChatMessage = { role: 'assistant', content: 'I can help with that!' };
    const result = await scrubMessage(assistantMsg, [new RedactEmailScanner()]);
    expect(result.message.scrubbed).toBe(false);
    expect(result.message.content).toBe('I can help with that!');
  });

  it('redacts PII from user messages', async () => {
    const userMsg: ChatMessage = { role: 'user', content: 'My email is test@example.com' };
    const result = await scrubMessage(userMsg, [new RedactEmailScanner()]);
    expect(result.message.scrubbed).toBe(true);
    expect(result.message.content).toBe('My email is [REDACTED-EMAIL]');
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]?.id).toBe('email');
  });

  it('preserves user messages with no issues', async () => {
    const userMsg: ChatMessage = { role: 'user', content: 'What is TypeScript?' };
    const result = await scrubMessage(userMsg, [new NoopScanner()]);
    expect(result.message.scrubbed).toBe(false);
    expect(result.message.content).toBe('What is TypeScript?');
  });

  it('handles scanner errors gracefully', async () => {
    const userMsg: ChatMessage = { role: 'user', content: 'Hello' };
    const result = await scrubMessage(userMsg, [new ErrorScanner()]);
    expect(result.error).toBe('Scanner error');
    expect(result.message.content).toBe('Hello');
  });

  it('chains multiple scanners', async () => {
    const userMsg: ChatMessage = { role: 'user', content: 'Email: user@test.com, KEY: secret123' };
    const redactPii = new RedactEmailScanner();
    const result = await scrubMessage(userMsg, [redactPii]);
    expect(result.message.content).toContain('[REDACTED-EMAIL]');
  });
});

describe('scrubMessagesForModel', () => {
  it('scrubs an array of messages preserving order', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a bot.' },
      { role: 'user', content: 'My email is user@test.com' },
      { role: 'assistant', content: 'Sure!' },
      { role: 'user', content: 'Another email: foo@bar.com' }
    ];

    const result = await scrubMessagesForModel(messages, [new RedactEmailScanner()]);

    expect(result).toHaveLength(4);
    expect(result[0]?.content).toBe('You are a bot.');
    expect(result[0]?.scrubbed).toBe(false);
    expect(result[1]?.content).toBe('My email is [REDACTED-EMAIL]');
    expect(result[1]?.scrubbed).toBe(true);
    expect(result[2]?.content).toBe('Sure!');
    expect(result[2]?.scrubbed).toBe(false);
    expect(result[3]?.content).toBe('Another email: [REDACTED-EMAIL]');
    expect(result[3]?.scrubbed).toBe(true);
  });

  it('handles empty messages array', async () => {
    const result = await scrubMessagesForModel([], [new NoopScanner()]);
    expect(result).toHaveLength(0);
  });

  it('marks scrubbed as false when no scanner triggers', async () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'What is 2+2?' }];
    const result = await scrubMessagesForModel(messages, [new NoopScanner()]);
    expect(result[0]?.scrubbed).toBe(false);
    expect(result[0]?.detections).toBeUndefined();
  });
});

describe('scrubMessagesDetailed', () => {
  it('returns per-message results with error isolation', async () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'BLOCK_ME' }
    ];

    const results = await scrubMessagesDetailed(messages, [new BlockScanner()]);

    expect(results).toHaveLength(2);
    // Message without BLOCK_ME should be fine
    expect(results[0]?.message.content).toBe('Hello');
    expect(results[0]?.error).toBeUndefined();
    // Error should be captured for the failed scanner
    expect(results[1]?.message.content).toBe('BLOCK_ME');
  });
});
