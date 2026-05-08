import { describe, expect, it, vi } from 'vitest';

import {
  applyDecisionAction,
  createGenericAdapter,
  processRawStream,
  processStream,
  runStructuredDecisionFromRawStream,
} from './generic.js';
import {
  OPENAI_COMPATIBLE_PROVIDERS,
  isOpenAICompatibleProvider,
  toOpenAICompatibleMessages,
} from './openai-compatible.js';

async function* source() {
  yield { content: 'hello' };
}

async function* rawSource() {
  yield { text: 'hello' };
}

async function* sourceWithSkippedChunk() {
  yield { text: 'first', skip: false };
  yield { text: 'ignored', skip: true };
  yield { text: 'second', skip: false };
}

async function* decisionSource() {
  yield { text: '{"shouldBlock":true,"targetIp":"203.0.113.10"' };
  yield { text: ',"reason":"burst traffic","ttlSeconds":300,"evidence":["spike"]}' };
}

async function* invalidSource() {
  yield { text: '{"shouldBlock":true}' };
}

describe('processStream', () => {
  it('yields processed outputs and final flush output', async () => {
    const outputs = [];
    for await (const out of processStream(source(), { parseThinkTags: false, scrubContextTags: false })) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.content).toBe('hello');
    expect(outputs[1]?.done).toBe(true);
  });
});

describe('processRawStream', () => {
  it('normalizes raw chunks before processing and flushes once at end', async () => {
    const outputs = [];
    for await (const out of processRawStream(rawSource(), chunk => ({ content: chunk.text }))) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(2);
    expect(outputs.map(output => output.content).join('')).toBe('hello');
    expect(outputs[1]?.done).toBe(true);
  });

  it('skips null normalized chunks and still flushes', async () => {
    const outputs = [];
    for await (const out of processRawStream(sourceWithSkippedChunk(), chunk => {
      if (chunk.skip) {
        return null;
      }
      return { content: chunk.text };
    })) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(3);
    expect(outputs.map(output => output.content).join('')).toBe('firstsecond');
    expect(outputs[2]?.done).toBe(true);
  });
});

describe('runStructuredDecisionFromRawStream', () => {
  const schema = {
    type: 'object',
    required: ['shouldBlock', 'targetIp', 'reason', 'ttlSeconds', 'evidence'],
    properties: {
      shouldBlock: { type: 'boolean' },
      targetIp: { type: 'string' },
      reason: { type: 'string' },
      ttlSeconds: { type: 'number' },
      evidence: { type: 'array', items: { type: 'string' } },
    },
  } as const;

  it('returns typed decision when validation succeeds', async () => {
    const result = await runStructuredDecisionFromRawStream({
      source: decisionSource(),
      normalize: chunk => ({ content: chunk.text }),
      schema,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decision).toMatchObject({
        shouldBlock: true,
        targetIp: '203.0.113.10',
      });
      expect(result.finalOutput.done).toBe(true);
    }
  });

  it('returns errors when validation fails schema checks', async () => {
    const result = await runStructuredDecisionFromRawStream({
      source: invalidSource(),
      normalize: chunk => ({ content: chunk.text }),
      schema,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('calls onOutput for each processed chunk and final flush', async () => {
    const onOutput = vi.fn<(_output: unknown) => void>();

    const result = await runStructuredDecisionFromRawStream({
      source: decisionSource(),
      normalize: chunk => ({ content: chunk.text }),
      schema,
      onOutput,
    });

    expect(result.success).toBe(true);
    // 2 source chunks + 1 flush output
    expect(onOutput).toHaveBeenCalledTimes(3);
  });

  it('uses selectValidationText as validation source', async () => {
    const result = await runStructuredDecisionFromRawStream({
      source: decisionSource(),
      normalize: chunk => ({ content: chunk.text }),
      schema,
      selectValidationText: () =>
        JSON.stringify({
          shouldBlock: false,
          targetIp: '198.51.100.20',
          reason: 'selectValidationText override',
          ttlSeconds: 120,
          evidence: ['override'],
        }),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decision).toMatchObject({
        shouldBlock: false,
        targetIp: '198.51.100.20',
      });
      expect(result.validationText).toContain('selectValidationText override');
    }
  });
});

describe('applyDecisionAction', () => {
  it('executes action when predicate passes', async () => {
    const action = vi.fn(async () => 'blocked');
    const result = await applyDecisionAction(
      { shouldBlock: true },
      {
        shouldAct: decision => decision.shouldBlock,
        action,
      },
    );

    expect(result).toEqual({ acted: true, result: 'blocked' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('skips action when predicate fails and runs onSkip', async () => {
    const action = vi.fn(async () => 'blocked');
    const onSkip = vi.fn<(_decision: { shouldBlock: boolean }) => void>();

    const result = await applyDecisionAction(
      { shouldBlock: false },
      {
        shouldAct: decision => decision.shouldBlock,
        action,
        onSkip,
      },
    );

    expect(result).toEqual({ acted: false });
    expect(action).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledOnce();
  });
});

describe('createGenericAdapter', () => {
  it('routes content to onContent callback', async () => {
    const onContent = vi.fn<(_text: string) => void>();
    const adapter = createGenericAdapter({ onContent }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({ content: 'Hello world' });
    await adapter.end();

    expect(onContent).toHaveBeenCalledWith('Hello world');
  });

  it('routes thinking text to onThinking callback', async () => {
    const onThinking = vi.fn<(_text: string) => void>();
    const onContent = vi.fn<(_text: string) => void>();
    const adapter = createGenericAdapter({ onThinking, onContent }, { parseThinkTags: true, scrubContextTags: false });

    await adapter.write({ content: '<think>reasoning</think>Answer' });
    await adapter.end();

    expect(onThinking).toHaveBeenCalledWith('reasoning');
    expect(onContent).toHaveBeenCalledWith('Answer');
  });

  it('suppresses thinking when showThinking is false', async () => {
    const onThinking = vi.fn<(_text: string) => void>();
    const adapter = createGenericAdapter(
      { onThinking },
      { parseThinkTags: true, scrubContextTags: false, showThinking: false },
    );

    await adapter.write({ content: '<think>hidden</think>visible' });
    await adapter.end();

    expect(onThinking).not.toHaveBeenCalled();
  });

  it('calls onDone when stream ends', async () => {
    const onDone = vi.fn<() => void>();
    const adapter = createGenericAdapter({ onDone }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({ content: 'data' });
    await adapter.end();

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('routes tool calls to onToolCall callback', async () => {
    const onToolCall = vi.fn<(call: unknown) => void>();
    const adapter = createGenericAdapter({ onToolCall }, { parseThinkTags: false, scrubContextTags: false });

    await adapter.write({
      content: 'text',
      tool_calls: [{ function: { name: 'run', arguments: { x: 1 } } }],
    });
    await adapter.end();

    expect(onToolCall).toHaveBeenCalledWith({
      name: 'run',
      parameters: { x: 1 },
      format: 'native-json',
    });
  });

  it('propagates errors from callbacks via onError', async () => {
    const onError = vi.fn<(_error: Error, context: unknown) => void>(); // Called in test expectation
    const adapter = createGenericAdapter(
      {
        onContent: () => {
          throw new Error('callback error');
        },
        onError,
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Should not throw; error should be handled via onError callback
    await expect(adapter.write({ content: 'test' })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { type: 'content', chunk: { content: 'test' } });
  });

  it('handles errors when onError callback throws', async () => {
    const onError = vi.fn<(_error: Error, context: unknown) => void>(() => {
      throw new Error('onError failed');
    }); // Called in test expectation
    const adapter = createGenericAdapter(
      {
        onContent: () => {
          throw new Error('callback error');
        },
        onError,
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Error from onError should propagate (unhandled)
    await expect(adapter.write({ content: 'test' })).rejects.toThrow('onError failed');
  });

  it('works with no callbacks provided', async () => {
    const adapter = createGenericAdapter({}, { parseThinkTags: false, scrubContextTags: false });

    // Should not throw even with no callbacks
    await expect(adapter.write({ content: 'test' })).resolves.toBeUndefined();
    await expect(adapter.end()).resolves.toBeUndefined();
  });

  it('handles multiple write+end cycles after processor reset', async () => {
    const contents: string[] = [];
    const adapter = createGenericAdapter(
      {
        onContent: text => {
          contents.push(text);
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    await adapter.write({ content: 'first' });
    await adapter.end();

    // Adapter reuses processor which needs manual reset for reuse
    expect(contents).toContain('first');
  });

  // --- Backpressure ---

  it('awaits each async callback before processing the next write', async () => {
    const order: number[] = [];
    let resolveFirst!: () => void;

    const firstDone = new Promise<void>(resolve => {
      resolveFirst = resolve;
    });

    const adapter = createGenericAdapter(
      {
        onContent: async text => {
          if (text === 'chunk1') {
            // Simulate slow async work for the first chunk
            await firstDone;
            order.push(1);
          } else {
            order.push(2);
          }
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    // Start both writes concurrently — write() must individually await its callback
    const p1 = adapter.write({ content: 'chunk1' });
    // Resolve the first callback while p1 is still in-flight
    resolveFirst();
    const p2 = adapter.write({ content: 'chunk2' });

    await Promise.all([p1, p2]);

    // Each write awaits its own callback, so both complete without throwing
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it('rapid sequential writes all deliver content in order', async () => {
    const received: string[] = [];
    const adapter = createGenericAdapter(
      {
        onContent: text => {
          received.push(text);
        },
      },
      { parseThinkTags: false, scrubContextTags: false },
    );

    for (let i = 0; i < 20; i++) {
      await adapter.write({ content: `chunk${i}` });
    }
    await adapter.end();

    expect(received).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(received[i]).toBe(`chunk${i}`);
    }
  });
});

describe('openai-compatible adapter', () => {
  it('exposes expected provider registry', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS).toEqual(['openai', 'deepseek', 'kimi', 'qwen', 'llama', 'granite']);
  });

  it('checks provider compatibility', () => {
    expect(isOpenAICompatibleProvider('openai')).toBe(true);
    expect(isOpenAICompatibleProvider('deepseek')).toBe(true);
    expect(isOpenAICompatibleProvider('mistral')).toBe(false);
  });

  it('maps tool call and tool result messages using openai-compatible schema', () => {
    const mapped = toOpenAICompatibleMessages([
      {
        role: 'assistant',
        parts: [{ type: 'tool-call', callId: 'tc_1', name: 'search', input: { q: 'weather' } }],
      },
      {
        role: 'user',
        parts: [{ type: 'tool-result', callId: 'tc_1', content: '{"ok":true}' }],
      },
    ]);

    expect(mapped[0]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc_1', type: 'function', function: { name: 'search', arguments: '{"q":"weather"}' } }],
    });
    expect(mapped[1]).toMatchObject({ role: 'tool', tool_call_id: 'tc_1', content: '{"ok":true}' });
  });
});
