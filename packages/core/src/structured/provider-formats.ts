export interface OpenAIResponseFormatOptions {
  /** Schema name included in the `json_schema` wrapper. Defaults to `"response"`. */
  name?: string;
  /**
   * Whether the model must strictly follow the provided schema.
   * Defaults to `true`.
   */
  strict?: boolean;
}

export interface OpenAIResponseFormat {
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
  type: 'json_schema';
}

export interface GeminiResponseSchema {
  responseMimeType: 'application/json';
  responseSchema: Record<string, unknown>;
}

/**
 * Builds an OpenAI `response_format` object for structured outputs.
 *
 * @example
 * const format = buildOpenAIResponseFormat(mySchema, { name: 'weather', strict: true });
 * // { type: 'json_schema', json_schema: { name: 'weather', strict: true, schema: mySchema } }
 */
export function buildOpenAIResponseFormat(
  schema: Record<string, unknown>,
  options?: OpenAIResponseFormatOptions
): OpenAIResponseFormat {
  return {
    json_schema: {
      name: options?.name ?? 'response',
      schema,
      strict: options?.strict ?? true
    },
    type: 'json_schema'
  };
}

/**
 * Returns the JSON Schema directly for use with Ollama's `format` parameter.
 * Ollama accepts a JSON Schema object (or the string `"json"`) as its format value.
 *
 * @example
 * const format = buildOllamaFormat(mySchema);
 * // mySchema (pass-through)
 */
export function buildOllamaFormat(schema: Record<string, unknown>): Record<string, unknown> {
  return schema;
}

/**
 * Builds a Gemini `GenerationConfig` fragment for structured JSON output.
 *
 * @example
 * const config = buildGeminiResponseSchema(mySchema);
 * // { responseMimeType: 'application/json', responseSchema: mySchema }
 */
export function buildGeminiResponseSchema(schema: Record<string, unknown>): GeminiResponseSchema {
  return {
    responseMimeType: 'application/json',
    responseSchema: schema
  };
}
