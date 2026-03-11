import { describe, expect, it, vi } from 'vitest';

import { createGenericAdapter, processStream } from './generic.js';
import { createVSCodeCopilotAdapter } from './vscode.js';
import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';

describe('processStream', () => {
  it('yields processed outputs and final flush output', async () => {
    async function* source() {
      yield { content: 'hello' };
    }

    const outputs = [];
    for await (const out of processStream(source(), { parseThinkTags: false, scrubContextTags: false })) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.content).toBe('hello');
    expect(outputs[1]?.done).toBe(true);
  });
});

describe('createVSCodeCopilotAdapter', () => {
  it('routes thinking/content to markdown and tool calls to callback', async () => {
    const markdown = vi.fn();
    const onToolCall = vi.fn();
    const processor = new LLMStreamProcessor({ parseThinkTags: true, scrubContextTags: false });
    const adapter = createVSCodeCopilotAdapter({
      processor,
      stream: { markdown },
      onToolCall,
      showThinking: true,
    });

    await adapter.write({
      content: '<think>plan</think>Answer',
      tool_calls: [{ function: { name: 'search_files', arguments: { query: 'x' } } }],
    });
    await adapter.end();

    expect(markdown).toHaveBeenCalled();
    expect(onToolCall).toHaveBeenCalledWith({
      name: 'search_files',
      parameters: { query: 'x' },
      format: 'json-wrapped',
    });
  });
});

describe('createGenericAdapter', () => {
  it('routes content to onContent callback', async () => {
    const onContent = vi.fn();
    const adapter = createGenericAdapter(
      { onContent },
      { parseThinkTags: false, scrubContextTags: false },
    );

    await adapter.write({ content: 'Hello world' });
    await adapter.end();

    expect(onContent).toHaveBeenCalledWith('Hello world');
  });

  it('routes thinking text to onThinking callback', async () => {
    const onThinking = vi.fn();
    const onContent = vi.fn();
    const adapter = createGenericAdapter(
      { onThinking, onContent },
      { parseThinkTags: true, scrubContextTags: false },
    );

    await adapter.write({ content: '<think>reasoning</think>Answer' });
    await adapter.end();

    expect(onThinking).toHaveBeenCalledWith('reasoning');
    expect(onContent).toHaveBeenCalledWith('Answer');
  });

  it('suppresses thinking when showThinking is false', async () => {
    const onThinking = vi.fn();
    const adapter = createGenericAdapter(
      { onThinking },
      { parseThinkTags: true, scrubContextTags: false, showThinking: false },
    );

    await adapter.write({ content: '<think>hidden</think>visible' });
    await adapter.end();

    expect(onThinking).not.toHaveBeenCalled();
  });

  it('calls onDone when stream ends', async () => {
    const onDone = vi.fn();
    const adapter = createGenericAdapter(
      { onDone },
      { parseThinkTags: false, scrubContextTags: false },
    );

    await adapter.write({ content: 'data' });
    await adapter.end();

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('routes tool calls to onToolCall callback', async () => {
    const onToolCall = vi.fn();
    const adapter = createGenericAdapter(
      { onToolCall },
      { parseThinkTags: false, scrubContextTags: false },
    );

    await adapter.write({
      content: 'text',
      tool_calls: [{ function: { name: 'run', arguments: { x: 1 } } }],
    });
    await adapter.end();

    expect(onToolCall).toHaveBeenCalledWith({
      name: 'run',
      parameters: { x: 1 },
      format: 'json-wrapped',
    });
  });
});
