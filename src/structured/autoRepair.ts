import { buildRepairPrompt } from './buildRepairPrompt.js';
import { validateJsonSchema, type ValidateJsonSchemaOptions } from './validateJsonSchema.js';

export interface AutoRepairOptions extends ValidateJsonSchemaOptions {
  /** Maximum number of repair attempts. Defaults to 3. */
  maxAttempts?: number;
  /** The original prompt that produced the output (included in repair prompts). */
  originalPrompt?: string;
}

export interface AutoRepairResult<T = unknown> {
  /** Whether the final output is valid. */
  success: boolean;
  /** The parsed data if successful, otherwise undefined. */
  data?: T;
  /** Validation errors from the last attempt if unsuccessful. */
  errors?: string[];
  /** Total number of attempts (including the initial parse). */
  attempts: number;
}

/**
 * Attempts to parse and validate JSON output against a schema, automatically
 * generating repair prompts and retrying via the provided `callLLM` callback.
 *
 * Follows the LangChain `OutputFixingParser` / `RetryParser` pattern:
 * 1. Parse the initial output and validate against the schema.
 * 2. On failure, build a repair prompt with the error and failed output.
 * 3. Call `callLLM` with the repair prompt to get a corrected output.
 * 4. Repeat until valid or `maxAttempts` is reached.
 *
 * @param initialOutput  The raw LLM output text to parse.
 * @param schema         JSON Schema the output must conform to.
 * @param callLLM        Async callback that sends a repair prompt to the LLM and returns text.
 * @param options        Repair and validation options.
 */
export async function repairWithLLM<T = unknown>(
  initialOutput: string,
  schema: Record<string, unknown>,
  callLLM: (repairPrompt: string) => Promise<string>,
  options: AutoRepairOptions = {},
): Promise<AutoRepairResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3;
  let currentOutput = initialOutput;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = validateJsonSchema<T>(currentOutput, schema, options);

    if (result.success) {
      return { success: true, data: result.data, attempts: attempt };
    }

    // Last attempt — don't retry
    if (attempt === maxAttempts) {
      return { success: false, errors: result.errors, attempts: attempt };
    }

    const repairPrompt = buildRepairPrompt({
      failedOutput: currentOutput,
      error: result.errors.join('\n'),
      schema,
      ...(options.originalPrompt !== undefined ? { originalPrompt: options.originalPrompt } : {}),
    });

    currentOutput = await callLLM(repairPrompt);
  }

  // Unreachable, but TypeScript needs it
  return { success: false, errors: ['$: max attempts reached'], attempts: maxAttempts };
}
