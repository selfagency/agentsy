import type { ReadableStream } from 'node:stream/web';

import { parseSSEStream } from '../sse/index.js';
import { normalizeOpenAIChatChunk } from '../normalizers/openai.js';
import { normalizeAnthropicEvent } from '../normalizers/anthropic.js';
import { normalizeGeminiChunk } from '../normalizers/gemini.js';
import { normalizeBedrockConverseEvent } from '../normalizers/bedrock.js';
import { normalizeMistralChunk } from '../normalizers/mistral.js';
import { normalizeOllamaChatChunk } from '../normalizers/ollama.js';
import { normalizeCohereEvent } from '../normalizers/cohere.js';
import { normalizeHuggingFaceTGIChunk } from '../normalizers/hfTgi.js';
import type { StreamChunk } from '../processor/LLMStreamProcessor.js';
import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import type { ProcessorOptions } from '../processor/index.js';

export type NormalizerProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'bedrock'
  | 'mistral'
  | 'ollama'
  | 'cohere'
  | 'hugging-face';

export interface PipelineOptions extends ProcessorOptions {
  provider: NormalizerProvider;
}

export interface PipelineEvent {
  type: 'delta' | 'thinking' | 'tool_call' | 'message_done' | 'error';
  content?: string;
  thinking?: string;
  tool_call?: { name: string; parameters: Record<string, unknown> };
  message?: string;
  provider: NormalizerProvider;
}

const NORMALIZERS: Record<NormalizerProvider, (data: unknown) => { chunk: StreamChunk; rawEvent?: unknown } | null> = {
  openai: normalizeOpenAIChatChunk,
  anthropic: normalizeAnthropicEvent,
  gemini: normalizeGeminiChunk,
  bedrock: normalizeBedrockConverseEvent,
  mistral: normalizeMistralChunk,
  ollama: normalizeOllamaChatChunk,
  cohere: normalizeCohereEvent,
  'hugging-face': normalizeHuggingFaceTGIChunk,
};

export async function* createPipeline(
  source: AsyncIterable<string> | ReadableStream<string>,
  options: PipelineOptions,
): AsyncGenerator<PipelineEvent> {
  const normalizer = NORMALIZERS[options.provider];
  if (!normalizer) {
    throw new Error(`Unknown provider: ${options.provider}`);
  }

  const processorOpts: ProcessorOptions = {
    scrubContextTags: options.scrubContextTags ?? false,
  };

  if (options.parseThinkTags !== undefined) processorOpts.parseThinkTags = options.parseThinkTags;
  if (options.extraScrubTags !== undefined) processorOpts.extraScrubTags = options.extraScrubTags;
  if (options.knownTools !== undefined) processorOpts.knownTools = options.knownTools;
  if (options.modelId !== undefined) processorOpts.modelId = options.modelId;

  const processor = new LLMStreamProcessor(processorOpts);

  try {
    for await (const sseEvent of parseSSEStream(source)) {
      try {
        if (!sseEvent.data || sseEvent.data === '[DONE]') {
          continue;
        }

        const parsed = JSON.parse(sseEvent.data);
        const normalized = normalizer(parsed);

        if (!normalized || typeof normalized !== 'object' || !('chunk' in normalized)) {
          continue;
        }

        const chunk = (normalized as any).chunk as StreamChunk;
        const output = processor.process(chunk);

        if (output.thinking) {
          yield { type: 'thinking', thinking: output.thinking, provider: options.provider };
        }

        if (output.content) {
          yield { type: 'delta', content: output.content, provider: options.provider };
        }

        for (const toolCall of output.toolCalls) {
          yield {
            type: 'tool_call',
            tool_call: {
              name: toolCall.name,
              parameters: toolCall.parameters,
            },
            provider: options.provider,
          };
        }

        if (output.done) {
          yield { type: 'message_done', provider: options.provider };
        }
      } catch (_error) {
        yield {
          type: 'error',
          message: _error instanceof Error ? _error.message : String(_error),
          provider: options.provider,
        };
      }
    }
  } catch (_error) {
    yield {
      type: 'error',
      message: _error instanceof Error ? _error.message : String(_error),
      provider: options.provider,
    };
  }
}
