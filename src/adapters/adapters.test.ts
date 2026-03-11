import { describe, expect, it, vi } from 'vitest';

import { processStream } from './generic.js';
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
