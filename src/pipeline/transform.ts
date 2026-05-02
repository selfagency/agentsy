import type { OutputPart } from '../processor/LLMStreamProcessor.js';

/**
 * A `TransformStream` that accepts and emits `OutputPart` values.
 * Use with `ReadableStream.pipeThrough()` or `LLMStreamProcessorOptions.transforms`.
 */
export type PipelineTransform = TransformStream<OutputPart, OutputPart>;

/**
 * Creates a transform that breaks large `text` deltas into smaller sub-chunks.
 *
 * Non-text parts are passed through unchanged. Useful for smoothing out bursty
 * LLM output so that downstream renderers receive a steadier stream of tokens.
 *
 * @param options.chunkSize - Maximum characters per emitted text chunk (default: 8).
 * @param options.delayMs - Optional delay in milliseconds between emitted sub-chunks (default: 0).
 */
export function createSmoothStream(options?: { chunkSize?: number; delayMs?: number }): PipelineTransform {
  const chunkSize = Math.max(1, options?.chunkSize ?? 8);
  const delayMs = Math.max(0, options?.delayMs ?? 0);

  return new TransformStream<OutputPart, OutputPart>({
    async transform(part, controller) {
      if (part.type !== 'text') {
        controller.enqueue(part);
        return;
      }
      const { text } = part;
      let offset = 0;
      while (offset < text.length) {
        if (delayMs > 0 && offset > 0) {
          await new Promise(resolve => {
            setTimeout(resolve, delayMs);
          });
        }
        controller.enqueue({ type: 'text', text: text.slice(offset, offset + chunkSize) });
        offset += chunkSize;
      }
    },
  });
}

/**
 * Creates a transform that strips `thinking` parts from the stream.
 *
 * All other parts pass through unchanged. Use when consumers never display
 * chain-of-thought reasoning and want to avoid processing those parts.
 */
export function createThinkingFilter(): PipelineTransform {
  return new TransformStream<OutputPart, OutputPart>({
    transform(part, controller) {
      if (part.type !== 'thinking') {
        controller.enqueue(part);
      }
    },
  });
}

/**
 * Creates a transform that passes through only `tool_call` parts whose `name`
 * matches one of the provided tool names.
 *
 * All non-`tool_call` parts (text, thinking, deltas) pass through unchanged.
 * Useful for consumers that only need to react to a subset of tool calls.
 *
 * @param toolNames - The tool names to allow through.
 */
export function createToolCallFilter(toolNames: string[]): PipelineTransform {
  const allowed = new Set(toolNames);

  return new TransformStream<OutputPart, OutputPart>({
    transform(part, controller) {
      if (part.type === 'tool_call' && !allowed.has(part.call.name)) {
        return;
      }
      controller.enqueue(part);
    },
  });
}
