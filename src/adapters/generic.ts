import {
  LLMStreamProcessor,
  type ProcessedOutput,
  type ProcessorOptions,
  type StreamChunk,
} from '../processor/LLMStreamProcessor.js';

export async function* processStream(
  source: AsyncIterable<StreamChunk>,
  options: ProcessorOptions = {},
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const chunk of source) {
    yield processor.process(chunk);
  }

  yield processor.flush();
}
