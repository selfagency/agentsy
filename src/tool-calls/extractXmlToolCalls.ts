export interface XmlToolCall {
  name: string;
  parameters: Record<string, unknown>;
  format: 'bare-xml' | 'json-wrapped';
}

function cleanXml(text: string): string {
  let cleaned = text.replace(/```xml\s*/gi, '').replace(/```\s*/g, '');
  cleaned = cleaned.replace(/^[^<]*/, '').replace(/[^>]*$/, '');
  return cleaned;
}

function extractJsonWrappedToolCall(
  rawTag: string,
  inner: string,
  knownTools: Set<string>,
): XmlToolCall | null {
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

    const argumentsValue =
      parsed.arguments && typeof parsed.arguments === 'object' && !Array.isArray(parsed.arguments)
        ? (parsed.arguments as Record<string, unknown>)
        : parsed.parameters && typeof parsed.parameters === 'object' && !Array.isArray(parsed.parameters)
          ? (parsed.parameters as Record<string, unknown>)
          : {};

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
 * Extracts tool calls from XML-formatted LLM output.
 * Supports both bare-XML (`<tool_name>`) and JSON-wrapped (`<toolcall>`) formats.
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

  return results;
}
