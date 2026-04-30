export interface XmlToolCall {
  name: string;
  parameters: Record<string, unknown>;
  /** How this tool call was encoded in the stream. */
  format: 'bare-xml' | 'json-wrapped' | 'native-json';
}

function cleanXml(text: string): string {
  let cleaned = text.replaceAll(/```xml\s*/gi, '').replaceAll(/```\s*/g, '');
  cleaned = cleaned.replace(/^[^<]*/, '').replace(/[^>]*$/, '');
  return cleaned;
}

/**
 * Attempts to parse bare Hermes-style JSON tool call output produced by models
 * like Qwen2.5Coder that ignore the XML system prompt and output raw JSON:
 *   {"name": "fn_name", "arguments": {...}}
 * or the OpenAI-style array variant:
 *   [{"name": "fn_name", "arguments": {...}}]
 */
function extractBareJsonToolCalls(text: string, knownTools: Set<string>): XmlToolCall[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  const results: XmlToolCall[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }
    const obj = candidate as Record<string, unknown>;
    const name = typeof obj['name'] === 'string' ? obj['name'] : null;
    if (!name || !knownTools.has(name)) {
      continue;
    }
    const args = obj['arguments'] ?? obj['parameters'] ?? {};
    const parameters =
      args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {};

    results.push({ name, parameters, format: 'json-wrapped' });
  }

  return results;
}

function extractJsonWrappedToolCall(rawTag: string, inner: string, knownTools: Set<string>): XmlToolCall | null {
  const wrapperName = rawTag.toLowerCase();
  if (wrapperName !== 'toolcall' && wrapperName !== 'tool_call') {
    return null;
  }

  try {
    const parsed = JSON.parse(inner.trim()) as {
      name?: unknown;
      arguments?: unknown;
      parameters?: unknown;
    };

    const name = typeof parsed.name === 'string' ? parsed.name : null;
    if (!name || !knownTools.has(name)) {
      return null;
    }

    let argumentsValue: Record<string, unknown>;
    if (parsed.arguments && typeof parsed.arguments === 'object' && !Array.isArray(parsed.arguments)) {
      argumentsValue = parsed.arguments as Record<string, unknown>;
    } else if (parsed.parameters && typeof parsed.parameters === 'object' && !Array.isArray(parsed.parameters)) {
      argumentsValue = parsed.parameters as Record<string, unknown>;
    } else {
      argumentsValue = {};
    }

    return {
      name,
      parameters: argumentsValue,
      format: 'json-wrapped',
    };
  } catch {
    return null;
  }
}

/**
 * Extracts tool calls from LLM output. Supports three formats:
 * - Bare XML: `<tool_name><param>value</param></tool_name>`
 * - JSON-wrapped: `<tool_call>{"name":"fn","arguments":{…}}</tool_call>` (Hermes / Qwen3)
 * - Bare JSON fallback: `{"name":"fn","arguments":{…}}` (Qwen2.5Coder when XML prompt is ignored)
 *
 * `<think>…</think>` reasoning blocks emitted by Qwen/DeepSeek before tool calls
 * are silently skipped.
 *
 * @returns An array of successfully parsed tool calls. Malformed or unrecognised
 *          tool calls are silently skipped — the function never throws.
 */
export function extractXmlToolCalls(text: string, knownTools: Set<string>): XmlToolCall[] {
  if (knownTools.size === 0) {
    return [];
  }

  const cleaned = cleanXml(text);
  const results: XmlToolCall[] = [];

  const toolPattern = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
  const paramPattern = /<([^/\s>]+)>([\s\S]*?)<\/\1>/g;

  for (const toolMatch of cleaned.matchAll(toolPattern)) {
    const toolName = toolMatch[1];
    const inner = toolMatch[2] ?? '';

    if (!toolName) {
      continue;
    }

    // Skip <think> reasoning blocks emitted by Qwen3 / DeepSeek-R1 models.
    if (toolName.toLowerCase() === 'think') {
      continue;
    }

    const jsonWrapped = extractJsonWrappedToolCall(toolName, inner, knownTools);
    if (jsonWrapped) {
      results.push(jsonWrapped);
      continue;
    }

    if (!knownTools.has(toolName)) {
      continue;
    }

    const params: Record<string, unknown> = {};
    for (const paramMatch of inner.matchAll(paramPattern)) {
      const paramName = paramMatch[1];
      const paramValue = paramMatch[2];
      if (!paramName) {
        continue;
      }
      params[paramName] = (paramValue ?? '').trim();
    }

    results.push({
      name: toolName,
      parameters: params,
      format: 'bare-xml',
    });
  }

  // Fallback: models like Qwen2.5Coder that ignore the XML system prompt and
  // emit a raw Hermes-style JSON object or array instead of XML.
  if (results.length === 0) {
    return extractBareJsonToolCalls(text, knownTools);
  }

  return results;
}
