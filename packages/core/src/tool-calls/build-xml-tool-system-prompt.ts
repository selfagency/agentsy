/**
 * A JSON Schema property descriptor. Covers the subset of JSON Schema draft 7 keywords
 * most commonly accepted by LLM tool-call APIs (OpenAI, Anthropic, DeepSeek, Llama, GLM).
 *
 * Extra keywords not listed here are still accepted via the index signature so that
 * schemas obtained from MCP tools or OpenAPI specs pass through without modification.
 */
export interface JsonSchemaProperty {
  $def?: Record<string, JsonSchemaProperty>;
  $defs?: Record<string, JsonSchemaProperty>;
  // Schema references (JSON Schema draft 7 / DeepSeek $def variant)
  $ref?: string;
  additionalProperties?: boolean | JsonSchemaProperty;
  allOf?: JsonSchemaProperty[];
  // Schema composition
  anyOf?: JsonSchemaProperty[];
  const?: unknown;
  default?: unknown;
  description?: string;
  enum?: unknown[];
  exclusiveMaximum?: number | boolean;
  exclusiveMinimum?: number | boolean;
  // String
  format?: string;
  // Array
  items?: JsonSchemaProperty | JsonSchemaProperty[];
  maxItems?: number;
  maximum?: number;
  maxLength?: number;
  minItems?: number;
  // Number / integer
  minimum?: number;
  minLength?: number;
  multipleOf?: number;
  not?: JsonSchemaProperty;
  oneOf?: JsonSchemaProperty[];
  pattern?: string;
  // Object
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  type?: string | string[];
  // Allow arbitrary vendor extensions
  [key: string]: unknown;
}

export interface XmlToolInfo {
  description?: string;
  inputSchema?: {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  name: string;
}

export interface BuildXmlToolSystemPromptOptions {
  /**
   * Controls the tool-calling instruction style injected into the system prompt.
   *
   * - `'xml'` *(default)* — Custom XML format: `<tool_name><param>value</param></tool_name>`.
   *   Works with most models but requires the model to follow novel formatting instructions.
   * - `'hermes'` — NousResearch Hermes 2 Pro format: `<tool_call>{"name":"…","arguments":{…}}</tool_call>`.
   *   Use for **Qwen** models (Qwen2.5, Qwen3, etc.) which are trained on this template.
   *   Responses are extracted by the existing `extractXmlToolCalls` JSON-wrapped path.
   * - `'none'` — Returns an empty string. Use when tools are passed via the provider's
   *   native API parameter (e.g. Ollama's `tools` field with `buildNativeToolsArray`) so
   *   the model's own chat template handles formatting — correct for **Gemma4** and other
   *   models with built-in tool-call tokens.
   */
  format?: 'xml' | 'hermes' | 'none';
}

const VALID_TOOL_NAME = /^[A-Za-z_][A-Za-z0-9_:-]*$/;

/**
 * Builds a system prompt instructing the LLM how to call tools.
 *
 * @param tools - Tool descriptors to expose to the model.
 * @param options - Optional configuration (see {@link BuildXmlToolSystemPromptOptions}).
 *
 * @throws {Error} If any tool name contains invalid characters (unless `format` is `'none'`).
 *         Tool names must start with a letter or underscore and contain only `[A-Za-z0-9_:-]`.
 * @returns The formatted system prompt string, or `''` if `tools` is empty or `format` is `'none'`.
 */
export function buildXmlToolSystemPrompt(
  tools: readonly XmlToolInfo[],
  options: BuildXmlToolSystemPromptOptions = {}
): string {
  const format = options.format ?? 'xml';

  if (format === 'none' || !tools.length) {
    return '';
  }

  for (const tool of tools) {
    if (!VALID_TOOL_NAME.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}": tool names must start with a letter or underscore and contain only letters, digits, underscores, colons, or hyphens.`
      );
    }
  }

  const exampleTool = tools[0];
  if (exampleTool === undefined) {
    return '';
  }

  if (format === 'hermes') {
    return buildHermesPrompt(tools, exampleTool);
  }

  return buildXmlPrompt(tools, exampleTool);
}

function buildXmlPrompt(tools: readonly XmlToolInfo[], exampleTool: XmlToolInfo): string {
  const toolDescriptions = tools.map(tool => {
    const schema = tool.inputSchema;
    const props = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);
    const paramLines = Object.entries(props).map(([name, s]) => {
      const hint = s.description ?? s.type ?? 'value';
      const optionalNote = required.has(name) ? '' : ' (optional)';
      return `  <${name}>${String(hint)}${optionalNote}</${name}>`;
    });

    return [`// ${tool.name}: ${tool.description ?? ''}`, `<${tool.name}>`, ...paramLines, `</${tool.name}>`].join(
      '\n'
    );
  });

  const exampleProps = Object.entries(exampleTool.inputSchema?.properties ?? {}).slice(0, 2);
  const exampleParamLines = exampleProps.map(([name]) => `  <${name}>example value</${name}>`);
  const exampleCall = [`<${exampleTool.name}>`, ...exampleParamLines, `</${exampleTool.name}>`].join('\n');

  return [
    '# Tool Use',
    '',
    'You have access to tools. When you need to call a tool, follow these rules exactly:',
    '1. Emit ONLY the raw XML block — no markdown fences (no ```xml), no prose before or after it.',
    '2. Call ONE tool per response. Wait for the result before calling another tool.',
    '3. When you have enough information to answer, respond in plain prose only. Do NOT include XML in your final answer.',
    '4. Never use JSON function-call syntax.',
    '',
    '## Available tools',
    '',
    toolDescriptions.join('\n\n'),
    '',
    `## Example (${exampleTool.name})`,
    '',
    '// Correct — bare XML only:',
    exampleCall,
    '',
    `// After you receive [Tool result: ${exampleTool.name}], answer in plain text.`
  ].join('\n');
}

function buildHermesToolSchema(tool: XmlToolInfo): string {
  const props = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required;

  const parameters: Record<string, unknown> = {
    additionalProperties: false,
    properties: props,
    type: 'object'
  };
  if (required && required.length > 0) {
    parameters.required = required;
  }

  const fn: Record<string, unknown> = { name: tool.name, parameters };
  if (tool.description) {
    fn.description = tool.description;
  }

  return JSON.stringify({ function: fn, type: 'function' });
}

function buildHermesPrompt(tools: readonly XmlToolInfo[], exampleTool: XmlToolInfo): string {
  const toolSchemas = tools.map(buildHermesToolSchema);

  const exampleArg = Object.keys(exampleTool.inputSchema?.properties ?? {})[0];
  const exampleArgStr = exampleArg ? `"${exampleArg}": "value"` : '';
  const exampleCall =
    `<tool_call>\n{"name": "${exampleTool.name}", "arguments": {${exampleArgStr}}}\n</tool_call>`.trim();

  return [
    'You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags.',
    'You may call one or more functions to assist with the user query.',
    "Don't make assumptions about what values to plug into functions.",
    'Here are the available tools:',
    '',
    '<tools>',
    toolSchemas.join('\n'),
    '</tools>',
    '',
    'For each function call, return a JSON object with the function name and arguments within <tool_call></tool_call> XML tags:',
    '<tool_call>',
    '{"name": <function-name>, "arguments": <args-dict>}',
    '</tool_call>',
    '',
    `Example:\n${exampleCall}`,
    '',
    'After you receive a tool result, continue reasoning and respond to the user in plain text.'
  ].join('\n');
}
