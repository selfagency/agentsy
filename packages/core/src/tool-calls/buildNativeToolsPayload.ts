import type { JsonSchemaProperty, XmlToolInfo } from './buildXmlToolSystemPrompt.js';

/** Options for {@link buildNativeToolsArray}. */
export interface BuildNativeToolsOptions {
  /**
   * When `true`, adds `"strict": true` to each function definition and recursively
   * sets `additionalProperties: false` on every nested object schema.
   *
   * Required by **DeepSeek strict mode** (beta endpoint) and **OpenAI structured outputs**.
   * In strict mode, every property of every object must also appear in `required`; callers
   * are responsible for ensuring their schemas satisfy this constraint.
   *
   * @default false
   */
  strict?: boolean;
}

/** OpenAI-compatible tool definition used by any OpenAI-compatible `/chat/completions` endpoint. */
export interface NativeTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    /** Set by `buildNativeToolsArray` when `options.strict` is `true`. */
    strict?: true;
    parameters: {
      type: 'object';
      properties: Record<string, JsonSchemaProperty>;
      required?: string[];
      additionalProperties: false;
    };
  };
}

/**
 * Recursively ensures every nested object schema has `additionalProperties: false`,
 * as required by DeepSeek strict mode and OpenAI structured outputs.
 */
function enforceStrictOnSchema(schema: JsonSchemaProperty): JsonSchemaProperty {
  if (schema.type !== 'object' || !schema.properties) return schema;
  // Security: Use Map instead of dynamic object construction to prevent
  // prototype pollution attacks from malicious schema definitions.
  const strictProperties = new Map<string, JsonSchemaProperty>();
  for (const [key, prop] of Object.entries(schema.properties)) {
    strictProperties.set(key, enforceStrictOnSchema(prop));
  }
  return { ...schema, additionalProperties: false, properties: Object.fromEntries(strictProperties.entries()) };
}

/**
 * Converts an array of `XmlToolInfo` descriptors into the OpenAI-compatible
 * `tools` array accepted by any `/chat/completions` endpoint with native function
 * calling (Ollama, OpenAI, Anthropic via OpenAI compat, DeepSeek, Llama API, GLM, etc.).
 *
 * Property schemas are passed through verbatim so that callers can supply the full
 * JSON Schema — including `format`, `pattern`, `minimum`/`maximum`, `items`,
 * nested objects, `anyOf`, `$ref`/`$defs`, etc. — without loss of information.
 *
 * @example
 * ```ts
 * const tools = buildNativeToolsArray([
 *   {
 *     name: 'get_weather',
 *     description: 'Get current weather for a city',
 *     inputSchema: {
 *       properties: {
 *         location: { type: 'string', description: 'City name' },
 *         unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
 *       },
 *       required: ['location'],
 *     },
 *   },
 * ]);
 *
 * // Pass directly to any OpenAI-compatible endpoint:
 * const body = { model: 'your-model', messages, tools };
 *
 * // DeepSeek strict mode (beta endpoint):
 * const strictTools = buildNativeToolsArray(myTools, { strict: true });
 * ```
 */
const VALID_TOOL_NAME = /^[A-Za-z_][A-Za-z0-9_:-]*$/;

export function buildNativeToolsArray(
  tools: readonly XmlToolInfo[],
  options: BuildNativeToolsOptions = {},
): NativeTool[] {
  const strict = options.strict ?? false;

  return tools.map(tool => {
    if (!VALID_TOOL_NAME.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}" for native tool payload: tool names must start with a letter or underscore and contain only letters, digits, underscores, colons, or hyphens.`,
      );
    }
    const props = tool.inputSchema?.properties ?? {};
    const required = tool.inputSchema?.required;

    // Security: Use Map instead of dynamic object construction to prevent
    // prototype pollution attacks from malicious schema definitions.
    const properties = new Map<string, JsonSchemaProperty>();
    for (const [paramName, schema] of Object.entries(props)) {
      properties.set(paramName, strict ? enforceStrictOnSchema(schema) : schema);
    }

    const fn: NativeTool['function'] = {
      name: tool.name,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(properties.entries()),
        additionalProperties: false,
      },
    };

    if (tool.description) fn.description = tool.description;
    if (strict) fn.strict = true;
    if (required && required.length > 0) {
      // Ensure `required` only contains names present in the `properties` Map.
      const filtered = required.filter(name => properties.has(name));
      if (filtered.length > 0) fn.parameters.required = filtered;
    }

    return { type: 'function', function: fn };
  });
}
