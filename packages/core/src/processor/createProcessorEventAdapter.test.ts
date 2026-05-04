import { describe, expect, it, vi } from 'vitest';
import { LLMStreamProcessor } from './LLMStreamProcessor.js';
import { createProcessorEventAdapter } from './createProcessorEventAdapter.js';

describe('createProcessorEventAdapter', () => {
  it('forwards onToolCallDelta, onStep, and onFinish callbacks', () => {
    const processor = new LLMStreamProcessor({ accumulateNativeToolCalls: true });
    const onToolCallDelta = vi.fn();
    const onStep = vi.fn();
    const onFinish = vi.fn();

    createProcessorEventAdapter(processor, {
      onToolCallDelta,
      onStep,
      onFinish,
    });

    processor.process({ stepIndex: 0, content: 'hello' });
    processor.process({ nativeToolCallDeltas: [{ index: 0, name: 'lookup', argumentsDelta: '{"q":' }] });
    processor.process({ nativeToolCallDeltas: [{ index: 0, argumentsDelta: '"x"}' }] });
    processor.process({ done: true, finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 2 } });

    expect(onToolCallDelta).toHaveBeenCalled();
    expect(onStep).toHaveBeenCalledWith(0, undefined);
    expect(onFinish).toHaveBeenCalledWith('tool-calls', { inputTokens: 1, outputTokens: 2 });
  });

  it('disposes listeners cleanly', () => {
    const processor = new LLMStreamProcessor();
    const onText = vi.fn();
    const adapter = createProcessorEventAdapter(processor, { onText });

    adapter.dispose();
    processor.process({ content: 'after-dispose' });

    expect(onText).not.toHaveBeenCalled();
  });
});
