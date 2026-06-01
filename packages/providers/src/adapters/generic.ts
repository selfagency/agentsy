import type { JsonObject } from '@agentsy/types';
import {
  LLMStreamProcessor,
  type ProcessedOutput,
  type ProcessorOptions,
  type StreamChunk
} from '@agentsy/core/processor';
import { type ValidateJsonSchemaOptions, validateJsonSchema } from '@agentsy/core/structured';
import type { XmlToolCall } from '@agentsy/core/tool-calls';

/**
 * Async generator that processes every chunk from a normalised LLM stream
 * and yields a `ProcessedOutput` for each chunk, finishing with a final flush output.
 */
export async function* processStream(
  source: AsyncIterable<StreamChunk>,
  options: ProcessorOptions = {}
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const chunk of source) {
    yield processor.process(chunk);
  }

  yield processor.flush();
}

/**
 * Async generator that normalises provider events and processes them through `LLMStreamProcessor`.
 */
export async function* processRawStream<TRawChunk>(
  source: AsyncIterable<TRawChunk>,
  normalize: (_chunk: TRawChunk) => StreamChunk | { chunk: StreamChunk } | null | undefined,
  options: ProcessorOptions = {}
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const rawChunk of source) {
    const normalized = normalize(rawChunk);
    if (normalized === null || normalized === undefined) {
      continue;
    }

    const chunk = 'chunk' in normalized ? normalized.chunk : normalized;
    yield processor.process(chunk);
  }

  yield processor.flush();
}

export interface RunStructuredDecisionFromRawStreamOptions<TRawChunk> {
  source: AsyncIterable<TRawChunk>;
  normalize: (_chunk: TRawChunk) => StreamChunk | { chunk: StreamChunk } | null | undefined;
  schema: JsonObject;
  processorOptions?: ProcessorOptions;
  validationOptions?: ValidateJsonSchemaOptions;
  onOutput?: (_output: ProcessedOutput) => void | Promise<void>;
  selectValidationText?: (_context: { processor: LLMStreamProcessor; finalOutput: ProcessedOutput }) => string;
}

export type StructuredDecisionResult<TDecision> =
  | {
      success: true;
      decision: TDecision;
      finalOutput: ProcessedOutput;
      validationText: string;
    }
  | {
      success: false;
      errors: string[];
      finalOutput: ProcessedOutput;
      validationText: string;
    };

export async function runStructuredDecisionFromRawStream<TRawChunk, TDecision = unknown>(
  options: RunStructuredDecisionFromRawStreamOptions<TRawChunk>
): Promise<StructuredDecisionResult<TDecision>> {
  const processor = new LLMStreamProcessor(options.processorOptions);

  for await (const rawChunk of options.source) {
    const normalized = options.normalize(rawChunk);
    if (normalized === null || normalized === undefined) {
      continue;
    }

    const chunk = 'chunk' in normalized ? normalized.chunk : normalized;
    const output = processor.process(chunk);
    if (options.onOutput !== undefined) {
      await options.onOutput(output);
    }
  }

  const finalOutput = processor.flush();
  if (options.onOutput !== undefined) {
    await options.onOutput(finalOutput);
  }

  const validationText =
    options.selectValidationText?.({ processor, finalOutput }) ?? processor.accumulatedMessage.content;

  const validated = validateJsonSchema<TDecision>(validationText, options.schema, options.validationOptions);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.errors,
      finalOutput,
      validationText
    };
  }

  return {
    success: true,
    decision: validated.data,
    finalOutput,
    validationText
  };
}

export interface ApplyDecisionActionOptions<TDecision, TResult> {
  shouldAct: (_decision: TDecision) => boolean;
  action: (_decision: TDecision) => Promise<TResult> | TResult;
  onSkip?: (_decision: TDecision) => void | Promise<void>;
}

export type ApplyDecisionActionResult<TResult> =
  | {
      acted: true;
      result: TResult;
    }
  | {
      acted: false;
    };

export async function applyDecisionAction<TDecision, TResult>(
  decision: TDecision,
  options: ApplyDecisionActionOptions<TDecision, TResult>
): Promise<ApplyDecisionActionResult<TResult>> {
  if (!options.shouldAct(decision)) {
    if (options.onSkip !== undefined) {
      await options.onSkip(decision);
    }
    return { acted: false };
  }

  const result = await options.action(decision);
  return { acted: true, result };
}

export interface GenericAdapterCallbacks {
  onThinking?: (_text: string) => void | Promise<void>;
  onContent?: (_text: string) => void | Promise<void>;
  onToolCall?: (_call: XmlToolCall) => void | Promise<void>;
  onDone?: () => void | Promise<void>;
  onError?: (_error: Error, _context: { type: string; chunk?: StreamChunk }) => void | Promise<void>;
}

export interface GenericAdapterOptions extends ProcessorOptions {
  showThinking?: boolean;
}

async function safeCall<T>(
  callback: (() => Promise<T>) | undefined,
  fallback: T,
  onError?: (_error: Error) => void
): Promise<T> {
  if (!callback) return fallback;
  try {
    return await callback();
  } catch (error) {
    const err = error as Error;
    onError?.(err);
    return fallback;
  }
}

export function createGenericAdapter(
  callbacks: GenericAdapterCallbacks,
  options: GenericAdapterOptions = {}
): {
  write(chunk: StreamChunk): Promise<void>;
  end(): Promise<void>;
} {
  const processor = new LLMStreamProcessor(options);
  const showThinking = options.showThinking ?? true;

  async function emit(output: ProcessedOutput, chunk?: StreamChunk): Promise<void> {
    if (output.thinking && showThinking) {
      await safeCall(
        () => callbacks.onThinking?.(output.thinking) ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'thinking', ...(chunk !== undefined && { chunk }) });
        }
      );
    }

    if (output.content) {
      await safeCall(
        () => callbacks.onContent?.(output.content) ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'content', ...(chunk !== undefined && { chunk }) });
        }
      );
    }

    for (const toolCall of output.toolCalls) {
      await safeCall(
        () => callbacks.onToolCall?.(toolCall) ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'tool_call', ...(chunk !== undefined && { chunk }) });
        }
      );
    }
  }

  return {
    async write(chunk: StreamChunk): Promise<void> {
      await emit(processor.process(chunk), chunk);
    },
    async end(): Promise<void> {
      await emit(processor.flush());
      await safeCall(
        () => callbacks.onDone?.() ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'done' });
        }
      );
    }
  };
}
