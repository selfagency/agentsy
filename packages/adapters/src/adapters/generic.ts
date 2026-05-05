import { LLMStreamProcessor, type ProcessedOutput, type ProcessorOptions, type StreamChunk } from '@agentsy/processor';
import { type ValidateJsonSchemaOptions, validateJsonSchema } from '@agentsy/structured';
import type { XmlToolCall } from '@agentsy/tool-calls';
import type { JsonObject } from '@agentsy/types';

/**
 * Async generator that processes every chunk from a normalised LLM stream
 * and yields a `ProcessedOutput` for each chunk, finishing with a final flush output.
 *
 * @example
 * ```ts
 * for await (const output of processStream(normalizedStream)) {
 *   if (output.content) process.stdout.write(output.content);
 * }
 * ```
 */
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

/**
 * Async generator that normalises raw provider chunks and processes them through `LLMStreamProcessor`.
 *
 * This removes the common boilerplate of manually normalising each chunk before calling `processor.process(...)`.
 */
export async function* processRawStream<TRawChunk>(
  source: AsyncIterable<TRawChunk>,
  normalize: (_chunk: TRawChunk) => StreamChunk,
  options: ProcessorOptions = {},
): AsyncGenerator<ProcessedOutput> {
  const processor = new LLMStreamProcessor(options);

  for await (const rawChunk of source) {
    yield processor.process(normalize(rawChunk));
  }

  yield processor.flush();
}

export interface RunStructuredDecisionFromRawStreamOptions<TRawChunk, TDecision> {
  source: AsyncIterable<TRawChunk>;
  normalize: (_chunk: TRawChunk) => StreamChunk;
  schema: JsonObject;
  processorOptions?: ProcessorOptions;
  validationOptions?: ValidateJsonSchemaOptions;
  /**
   * Hook for streaming-side effects (rendering/logging/etc.) while chunks are being processed.
   */
  onOutput?: (_output: ProcessedOutput) => void | Promise<void>;
  /**
   * Optional custom selector for the final text to validate.
   * Defaults to `processor.accumulatedMessage.content`.
   */
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

/**
 * Runs a full raw-stream -> normalise -> process -> schema-validation flow and returns
 * a typed structured decision. Useful for policy/automation gates that would otherwise
 * repeat this orchestration in each app.
 */
export async function runStructuredDecisionFromRawStream<TRawChunk, TDecision = unknown>(
  options: RunStructuredDecisionFromRawStreamOptions<TRawChunk, TDecision>,
): Promise<StructuredDecisionResult<TDecision>> {
  const processor = new LLMStreamProcessor(options.processorOptions);

  for await (const rawChunk of options.source) {
    const output = processor.process(options.normalize(rawChunk));
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
      validationText,
    };
  }

  return {
    success: true,
    decision: validated.data,
    finalOutput,
    validationText,
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

/**
 * Generic decision gate for side effects. Evaluates `shouldAct` and executes `action` only
 * when allowed, returning whether an action was executed.
 */
export async function applyDecisionAction<TDecision, TResult>(
  decision: TDecision,
  options: ApplyDecisionActionOptions<TDecision, TResult>,
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
  /** Called with thinking/reasoning text (if enabled). */
  onThinking?: (_text: string) => void | Promise<void>;
  /** Called with content text. */
  onContent?: (_text: string) => void | Promise<void>;
  /** Called for each extracted tool call. */
  onToolCall?: (_call: XmlToolCall) => void | Promise<void>;
  /** Called when the stream is complete. */
  onDone?: () => void | Promise<void>;
  /** Called when any callback throws an error. */
  onError?: (_error: Error, _context: { type: string; chunk?: StreamChunk }) => void | Promise<void>;
}

export interface GenericAdapterOptions extends ProcessorOptions {
  /** Whether to forward thinking text. Defaults to true. */
  showThinking?: boolean;
}

/**
 * Creates a callback-based adapter for processing LLM streams in any environment.
 * Similar to `createVSCodeCopilotAdapter` but environment-agnostic.
 *
 * @example
 * ```ts
 * const adapter = createGenericAdapter({
 *   onContent: (text) => process.stdout.write(text),
 *   onToolCall: (call) => handleTool(call),
 * });
 *
 * for await (const chunk of llmStream) {
 *   await adapter.write(chunk);
 * }
 * await adapter.end();
 * ```
 */

async function safeCall<T>(
  callback: (() => Promise<T>) | undefined,
  fallback: T,
  onError?: (_error: Error) => void,
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
  options: GenericAdapterOptions = {},
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
        },
      );
    }

    if (output.content) {
      await safeCall(
        () => callbacks.onContent?.(output.content) ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'content', ...(chunk !== undefined && { chunk }) });
        },
      );
    }

    for (const toolCall of output.toolCalls) {
      await safeCall(
        () => callbacks.onToolCall?.(toolCall) ?? Promise.resolve(),
        undefined,
        error => {
          void callbacks.onError?.(error, { type: 'tool_call', ...(chunk !== undefined && { chunk }) });
        },
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
        },
      );
    },
  };
}
