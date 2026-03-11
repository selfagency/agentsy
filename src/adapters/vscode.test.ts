import { describe, expect, it, vi } from 'vitest';

import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { createVSCodeCopilotAdapter } from './vscode.js';

describe('createVSCodeCopilotAdapter', () => {
  it('routes visible text output to markdown sink', async () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const stream = { markdown: vi.fn() };
    const onToolCall = vi.fn();

    const adapter = createVSCodeCopilotAdapter({ processor, stream, onToolCall });
    await adapter.write({ content: 'hello' });

    expect(stream.markdown).toHaveBeenCalledTimes(1);
    expect(stream.markdown).toHaveBeenCalledWith('hello');
    expect(onToolCall).not.toHaveBeenCalled();
  });

  it('forwards extracted tool calls to callback', async () => {
    const processor = new LLMStreamProcessor({
      parseThinkTags: false,
      scrubContextTags: false,
      knownTools: new Set(['search_files']),
    });
    const stream = { markdown: vi.fn() };
    const onToolCall = vi.fn();

    const adapter = createVSCodeCopilotAdapter({ processor, stream, onToolCall });
    await adapter.write({ content: '<search_files><query>abc</query></search_files>' });

    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith({
      name: 'search_files',
      parameters: { query: 'abc' },
      format: 'bare-xml',
    });
  });

  it('renders thinking as blockquote text when enabled', async () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const stream = { markdown: vi.fn() };
    const onToolCall = vi.fn();

    const adapter = createVSCodeCopilotAdapter({ processor, stream, onToolCall, showThinking: true });
    await adapter.write({ thinking: 'step1\nstep2' });

    expect(stream.markdown).toHaveBeenCalledWith('> step1\n> step2');
  });

  it('supports report-based sink shape', async () => {
    const processor = new LLMStreamProcessor({ parseThinkTags: false, scrubContextTags: false });
    const stream = { report: vi.fn() };
    const onToolCall = vi.fn();

    const adapter = createVSCodeCopilotAdapter({ processor, stream, onToolCall });
    await adapter.write({ content: 'hello' });

    expect(stream.report).toHaveBeenCalledWith({ type: 'text', text: 'hello' });
  });
});
