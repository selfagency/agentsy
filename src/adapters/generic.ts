import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';

import type { ProcessedOutput, ProcessorOptions, StreamChunk } from '../processor/types.js';

export async function* processStream(
  source: AsyncIterable<StreamChunk>,
  options: ProcessorOptions = {},
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const chunk of source) {
    const out = processor.process(chunk);
    if (out.content || out.thinking || out.toolCalls.length > 0 || out.parts.length > 0 || out.done) {
      yield out;
    }
  }

  const flushed = processor.flush();
  if (flushed.content || flushed.thinking || flushed.toolCalls.length > 0 || flushed.parts.length > 0) {
    yield flushed;
  }
}
