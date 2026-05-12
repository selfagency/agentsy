/**
 * Integration: renderers + processor
 *
 * Tests that the plain-text renderer correctly wires to the processor via
 * `createSharedRendererHandle`, forwarding text/thinking/toolCall callbacks
 * and calling onFinish after `end()`.
 */
import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createPlainTextRenderer, createSharedRendererHandle, type BaseRendererOptions } from '@agentsy/renderers';

// ---------------------------------------------------------------------------
// Plain-text renderer
// ---------------------------------------------------------------------------

describe('createPlainTextRenderer + LLMStreamProcessor', () => {
  it('collects text written via write()', async () => {
    const collected: string[] = [];
    const renderer = createPlainTextRenderer({
      output: chunk => collected.push(chunk),
    });

    await renderer.write('Hello');
    await renderer.write(', world!');
    await renderer.end();

    expect(collected.join('')).toBe('Hello, world!');
  });

  it('passes raw StreamChunks via writeChunk()', async () => {
    const collected: string[] = [];
    const renderer = createPlainTextRenderer({
      output: chunk => collected.push(chunk),
    });

    await renderer.writeChunk({ content: 'chunk one' });
    await renderer.writeChunk({ content: ' chunk two', done: true });
    await renderer.end();

    expect(collected.join('')).toBe('chunk one chunk two');
  });

  it('suppresses thinking by default', async () => {
    const collected: string[] = [];
    const renderer = createPlainTextRenderer({
      output: chunk => collected.push(chunk),
      showThinking: false,
    });

    await renderer.writeChunk({ thinking: 'internal thought', content: 'answer' });
    await renderer.end();

    expect(collected.join('')).toBe('answer');
    expect(collected.join('')).not.toContain('internal thought');
  });

  it('forwards thinking text when showThinking=true', async () => {
    const collected: string[] = [];
    const renderer = createPlainTextRenderer({
      output: chunk => collected.push(chunk),
      showThinking: true,
      thinkingPrefix: '[T] ',
    });

    await renderer.writeChunk({ thinking: 'thought' });
    await renderer.end();

    expect(collected.join('')).toContain('[T] thought');
  });

  it('calls onFinish with finishReason and usage after end()', async () => {
    const onFinish = vi.fn<NonNullable<BaseRendererOptions['onFinish']>>();
    const renderer = createPlainTextRenderer({
      output: () => {},
      onFinish,
    });

    await renderer.writeChunk({
      content: 'done',
      done: true,
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 3 },
    });
    await renderer.end();

    expect(onFinish).toHaveBeenCalledWith('stop', { inputTokens: 5, outputTokens: 3 });
  });

  it('calls onToolCall when an XML tool call is encountered', async () => {
    const onToolCall = vi.fn<NonNullable<BaseRendererOptions['onToolCall']>>();
    const processor = new LLMStreamProcessor({ knownTools: new Set(['lookup']) });

    const renderer = createPlainTextRenderer({
      output: () => {},
      processor,
      onToolCall,
    });

    await renderer.writeChunk({
      content: '<lookup><term>vitest</term></lookup>',
      done: true,
    });
    await renderer.end();

    expect(onToolCall).toHaveBeenCalledTimes(1);
    const firstCall = onToolCall.mock.calls[0];
    expect(firstCall).toBeDefined();
    const call = firstCall?.[0];
    expect(call?.call.name).toBe('lookup');
    expect(call?.call.parameters).toEqual({ term: 'vitest' });
  });
});

// ---------------------------------------------------------------------------
// createSharedRendererHandle — lower-level integration
// ---------------------------------------------------------------------------

describe('createSharedRendererHandle', () => {
  it('routes text/thinking/toolCall through the appropriate handler callbacks', async () => {
    const texts: string[] = [];
    const thinkings: string[] = [];
    const toolCalls: string[] = [];

    const processor = new LLMStreamProcessor({ knownTools: new Set(['ping']) });

    const handle = createSharedRendererHandle(
      { processor, showThinking: true },
      {
        onText: async t => {
          texts.push(t);
        },
        onThinking: async t => {
          thinkings.push(t);
        },
        onToolCall: async part => {
          toolCalls.push(part.call.name);
        },
      },
    );

    await handle.writeChunk({ thinking: 'a thought', content: 'text part' });
    await handle.writeChunk({ content: '<ping></ping>', done: true });
    await handle.end();

    expect(texts.join('')).toContain('text part');
    expect(thinkings.join('')).toBe('a thought');
    expect(toolCalls).toContain('ping');
  });

  it('respects a shared external processor', async () => {
    const externalProcessor = new LLMStreamProcessor();
    const texts: string[] = [];

    const handle = createSharedRendererHandle(
      { processor: externalProcessor },
      {
        onText: async t => {
          texts.push(t);
        },
        onThinking: async () => {},
      },
    );

    await handle.write('direct write');
    await handle.end();

    expect(texts.join('')).toBe('direct write');
    // The external processor should have accumulated the content
    expect(externalProcessor.accumulatedMessage.content).toBe('direct write');
  });

  it('invokes onFinish after end() with accumulated usage', async () => {
    const finishArgs: [string | undefined, unknown][] = [];

    const handle = createSharedRendererHandle(
      {
        onFinish: async (reason, usage) => {
          finishArgs.push([reason, usage]);
        },
      },
      { onText: async () => {}, onThinking: async () => {} },
    );

    await handle.writeChunk({ content: 'hi', done: true, finishReason: 'stop', usage: { outputTokens: 2 } });
    await handle.end();

    expect(finishArgs).toHaveLength(1);
    const firstFinish = finishArgs[0];
    expect(firstFinish).toBeDefined();
    expect(firstFinish?.[0]).toBe('stop');
    expect(firstFinish?.[1]).toMatchObject({ outputTokens: 2 });
  });
});

// ---------------------------------------------------------------------------
// Generic adapter (from @agentsy/core/adapters)
// ---------------------------------------------------------------------------

describe('processStream generic adapter', () => {
  it('yields ProcessedOutput for each StreamChunk via processStream', async () => {
    const { processStream } = await import('@agentsy/core/adapters');

    const chunks = [{ content: 'Hello' }, { content: ' world' }, { content: '', done: true }];

    async function* gen() {
      for (const c of chunks) yield c;
    }

    const outputs: string[] = [];
    for await (const out of processStream(gen())) {
      if (out.content) outputs.push(out.content);
    }

    expect(outputs.join('')).toBe('Hello world');
  });
});
