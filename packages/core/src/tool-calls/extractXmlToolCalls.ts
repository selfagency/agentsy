import type { JsonObject } from '@agentsy/types';

export interface XmlToolCall {
  name: string;
  parameters: JsonObject;
  /** How this tool call was encoded in the stream. */
  format: 'bare-xml' | 'json-wrapped' | 'native-json';
  /** Provider-assigned call ID, present when the provider supplies one (e.g. OpenAI, Anthropic, Bedrock). */
  id?: string;
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
  // Try to be permissive: models sometimes emit prose or markdown fences
  // before the raw JSON. Strip common fences and then find the first JSON
  // object/array opening and attempt to parse from there.
  const normalized = text.replaceAll(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();
  const firstBracket = normalized.search(/[{[]/);
  if (firstBracket === -1) return [];

  const jsonSlice = normalized.slice(firstBracket).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
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
    const name = typeof obj.name === 'string' ? obj.name : null;
    if (!name || !knownTools.has(name)) {
      continue;
    }
    const args = obj.arguments ?? obj.parameters ?? {};
    const parameters =
      typeof args === 'object' && !Array.isArray(args)
        ? (Object.assign(Object.create(null), args) as JsonObject)
        : (Object.create(null) as JsonObject);

    results.push({ name, parameters, format: 'json-wrapped' });
  }

  return results;
}

function extractJsonWrappedToolCall(rawTag: string, inner: string, knownTools: Set<string>): XmlToolCall | null {
  if (!isJsonToolCallWrapper(rawTag)) {
    return null;
  }

  const parsed = parseJsonToolCallPayload(inner);
  if (parsed === null) {
    return null;
  }

  const name = parseKnownToolName(parsed.name, knownTools);
  if (name === null) {
    return null;
  }

  return {
    name,
    parameters: normalizeWrappedToolCallArguments(parsed),
    format: 'json-wrapped',
  };
}

function isJsonToolCallWrapper(rawTag: string): boolean {
  const wrapperName = rawTag.toLowerCase();
  return wrapperName === 'toolcall' || wrapperName === 'tool_call';
}

function parseJsonToolCallPayload(inner: string): { name?: unknown; arguments?: unknown; parameters?: unknown } | null {
  try {
    return JSON.parse(inner.trim()) as {
      name?: unknown;
      arguments?: unknown;
      parameters?: unknown;
    };
  } catch {
    return null;
  }
}

function parseKnownToolName(name: unknown, knownTools: Set<string>): string | null {
  if (typeof name !== 'string') {
    return null;
  }
  return knownTools.has(name) ? name : null;
}

function normalizeWrappedToolCallArguments(parsed: { arguments?: unknown; parameters?: unknown }): JsonObject {
  const args = pickFirstObjectValue(parsed.arguments, parsed.parameters);
  if (args === null) {
    return Object.create(null) as JsonObject;
  }
  return Object.assign(Object.create(null), args) as JsonObject;
}

function pickFirstObjectValue(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
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
function extractBareXmlParams(inner: string, paramPattern: RegExp): JsonObject {
  // Use a null-prototype object to avoid prototype pollution when assigning
  // properties from untrusted XML input (e.g., <__proto__> tags).
  // Validate paramName to prevent injection attacks.
  const VALID_PARAM_NAME = /^[A-Za-z_]\w*$/;
  const params = Object.create(null) as JsonObject;
  for (const paramMatch of inner.matchAll(paramPattern)) {
    const paramName = paramMatch[1];
    if (!paramName || !VALID_PARAM_NAME.test(paramName)) continue;
    const raw = paramMatch[2];
    params[paramName] = (typeof raw === 'string' ? raw : '').trim();
  }
  return params;
}

export function extractXmlToolCalls(text: string, knownTools: Set<string>): XmlToolCall[] {
  if (knownTools.size === 0) {
    return [];
  }

  const cleaned = cleanXml(text);
  const results: XmlToolCall[] = [];

  const toolPattern = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
  const paramPattern = /<([^/\s>]+)>([\s\S]*?)<\/\1>/g;

  for (const toolMatch of cleaned.matchAll(toolPattern)) {
    const parsed = parseXmlToolCallMatch(toolMatch, knownTools, paramPattern);
    if (parsed !== null) {
      results.push(parsed);
    }
  }

  // Fallback: models like Qwen2.5Coder that ignore the XML system prompt and
  // emit a raw Hermes-style JSON object or array instead of XML.
  if (results.length === 0) {
    return extractBareJsonToolCalls(text, knownTools);
  }

  return results;
}

function parseXmlToolCallMatch(
  toolMatch: RegExpMatchArray,
  knownTools: Set<string>,
  paramPattern: RegExp,
): XmlToolCall | null {
  const toolName = toolMatch[1];
  const inner = toolMatch[2] ?? '';
  if (!toolName || toolName.toLowerCase() === 'think') {
    return null;
  }

  const jsonWrapped = extractJsonWrappedToolCall(toolName, inner, knownTools);
  if (jsonWrapped !== null) {
    return jsonWrapped;
  }

  if (!knownTools.has(toolName)) {
    return null;
  }

  return {
    name: toolName,
    parameters: extractBareXmlParams(inner, paramPattern),
    format: 'bare-xml',
  };
}
