export interface XmlToolInfo {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
}

const VALID_TOOL_NAME = /^[A-Za-z_][A-Za-z0-9_:-]*$/;

/**
 * Builds a system prompt instructing the LLM how to call tools via XML.
 *
 * @throws {Error} If any tool name contains invalid characters. Tool names must
 *         start with a letter or underscore and contain only `[A-Za-z0-9_:-]`.
 * @returns The formatted system prompt string, or `''` if `tools` is empty.
 */
export function buildXmlToolSystemPrompt(tools: readonly XmlToolInfo[]): string {
  if (!tools.length) {
    return '';
  }

  for (const tool of tools) {
    if (!VALID_TOOL_NAME.test(tool.name)) {
      throw new Error(
        `Invalid tool name "${tool.name}": tool names must start with a letter or underscore and contain only letters, digits, underscores, colons, or hyphens.`,
      );
    }
  }

  const toolDescriptions = tools.map(tool => {
    const schema = tool.inputSchema;
    const props = schema?.properties ?? {};
    const required = new Set(schema?.required ?? []);
    const paramLines = Object.entries(props).map(([name, s]) => {
      const hint = s.description ?? s.type ?? 'value';
      const optionalNote = required.has(name) ? '' : ' (optional)';
      return `  <${name}>${hint}${optionalNote}</${name}>`;
    });

    return [`// ${tool.name}: ${tool.description ?? ''}`, `<${tool.name}>`, ...paramLines, `</${tool.name}>`].join('\n');
  });

  const exampleTool = tools[0];
  const exampleProps = Object.entries(exampleTool?.inputSchema?.properties ?? {}).slice(0, 2);
  const exampleParamLines = exampleProps.map(([name]) => `  <${name}>example value</${name}>`);
  const exampleCall = [`<${exampleTool?.name}>`, ...exampleParamLines, `</${exampleTool?.name}>`].join('\n');

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
    `## Example (${exampleTool?.name})`,
    '',
    '// Correct — bare XML only:',
    exampleCall,
    '',
    `// After you receive [Tool result: ${exampleTool?.name}], answer in plain text.`,
  ].join('\n');
}
