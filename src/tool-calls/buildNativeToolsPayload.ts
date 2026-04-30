import type { XmlToolInfo } from './buildXmlToolSystemPrompt.js';

/** A single parameter property in the JSON Schema `parameters` object. */
export interface NativeToolParameter {
  type?: string;
  description?: string;
  enum?: string[];
}

/** OpenAI-compatible tool definition used by the Ollama `/api/chat` `tools` field. */
export interface NativeTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, NativeToolParameter>;
      required?: string[];
      additionalProperties: false;
    };
  };
}

/**
 * Converts an array of `XmlToolInfo` descriptors into the OpenAI-compatible
 * `tools` array accepted by Ollama's `/api/chat` endpoint (and any
 * OpenAI-compatible API that supports native function calling).
 *
 * Passing this array as the `tools` field lets Ollama inject the tool
 * declarations into the model's native chat template (e.g. Gemma4's
 * `<|tool>…<tool|>` tokens, Qwen's Hermes template) rather than relying on a
 * manually-crafted system prompt.  The model's structured `tool_calls` response
 * is then handled by `normalizeOllamaChatChunk` / `ToolCallAccumulator` in the
 * usual way.
 *
 * @example
 * ```ts
 * const tools = buildNativeToolsArray([
 *   {
 *     name: 'get_weather',
 *     description: 'Get current weather for a city',
 *     inputSchema: {
 *       properties: { location: { type: 'string', description: 'City name' } },
 *       required: ['location'],
 *     },
 *   },
 * ]);
 *
 * // Pass directly to Ollama (or any OpenAI-compatible endpoint):
 * const body = { model: 'gemma4:e4b', messages, tools };
 * ```
 */
const SAFE_PROPERTY_NAME = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function buildNativeToolsArray(tools: readonly XmlToolInfo[]): NativeTool[] {
  return tools.map(tool => {
    const props = tool.inputSchema?.properties ?? {};
    const required = tool.inputSchema?.required;

    const properties: Record<string, NativeToolParameter> = {};
    for (const [paramName, schema] of Object.entries(props)) {
      if (!SAFE_PROPERTY_NAME.test(paramName)) continue;
      const param: NativeToolParameter = {};
      if (schema.type) param.type = schema.type;
      if (schema.description) param.description = schema.description;
      if (schema.enum && schema.enum.length > 0) param.enum = schema.enum;
      properties[paramName] = param;
    }

    const fn: NativeTool['function'] = {
      name: tool.name,
      parameters: { type: 'object', properties, additionalProperties: false },
    };

    if (tool.description) fn.description = tool.description;
    if (required && required.length > 0) fn.parameters.required = required;

    return { type: 'function', function: fn };
  });
}
