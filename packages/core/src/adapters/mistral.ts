export type MistralContentPart = { type: 'text'; text: string } | { type: 'image_url'; imageUrl: string };

export type MistralToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type MistralMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | MistralContentPart[] }
  | { role: 'assistant'; content: string | MistralContentPart[] | null; toolCalls?: MistralToolCall[] }
  | { role: 'tool'; content: string | null; toolCallId: string; name?: string };

export type MistralOutboundPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: Uint8Array | string }
  | { type: 'tool-call'; callId: string; name: string; input?: Record<string, unknown> }
  | { type: 'tool-result'; callId: string; content: string };

export interface MistralOutboundMessage {
  role: 'system' | 'user' | 'assistant';
  parts: MistralOutboundPart[];
}

export interface MistralOutboundAdapterOptions {
  /** Optional custom tool-call id normalizer. */
  normalizeToolCallId?: (originalId: string) => string;
  /** Optional warning hook for dropped/adjusted parts. */
  onWarning?: (message: string, context?: Record<string, unknown>) => void;
}

const VALID_MISTRAL_TOOL_CALL_ID = /^[A-Za-z0-9]{9}$/;

function defaultNormalizeToolCallIdFactory(): (originalId: string) => string {
  let next = 0;
  const cache = new Map<string, string>();

  return (originalId: string): string => {
    if (VALID_MISTRAL_TOOL_CALL_ID.test(originalId)) {
      cache.set(originalId, originalId);
      return originalId;
    }

    const existing = cache.get(originalId);
    if (existing !== undefined) {
      return existing;
    }

    next += 1;
    const normalized = `tc${String(next).padStart(7, '0')}`;
    cache.set(originalId, normalized);
    return normalized;
  };
}

function toImageDataUri(mimeType: string, data: Uint8Array | string): string {
  if (typeof data === 'string') {
    if (data.startsWith('data:')) return data;
    return `data:${mimeType};base64,${data}`;
  }
  const base64 = Buffer.from(data).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Converts VS Code-like outbound chat messages into Mistral chat request messages.
 */
export function toMistralMessages(
  messages: readonly MistralOutboundMessage[],
  options: MistralOutboundAdapterOptions = {},
): MistralMessage[] {
  const normalizeToolCallId = options.normalizeToolCallId ?? defaultNormalizeToolCallIdFactory();
  const out: MistralMessage[] = [];
  const toolNameById = new Map<string, string>();

  for (const message of messages) {
    const textParts: string[] = [];
    const imageParts: MistralContentPart[] = [];
    const toolCalls: MistralToolCall[] = [];
    const toolResults: Array<{ callId: string; content: string }> = [];

    for (const part of message.parts) {
      if (part.type === 'text') {
        textParts.push(part.text);
        continue;
      }

      if (part.type === 'image') {
        if (message.role === 'system') {
          options.onWarning?.('Dropping non-text system image part for Mistral message.', {
            role: message.role,
            mimeType: part.mimeType,
          });
          continue;
        }

        imageParts.push({
          type: 'image_url',
          imageUrl: toImageDataUri(part.mimeType, part.data),
        });
        continue;
      }

      if (part.type === 'tool-call') {
        const normalizedCallId = normalizeToolCallId(part.callId);
        toolNameById.set(normalizedCallId, part.name);
        toolCalls.push({
          id: normalizedCallId,
          type: 'function',
          function: {
            name: part.name,
            arguments: JSON.stringify(part.input ?? {}),
          },
        });
        continue;
      }

      const normalizedCallId = normalizeToolCallId(part.callId);
      toolResults.push({
        callId: normalizedCallId,
        content: part.content,
      });
    }

    const text = textParts.join('');
    const hasText = text.length > 0;
    const hasImages = imageParts.length > 0;
    const hasToolCalls = toolCalls.length > 0;

    if (message.role === 'system') {
      if (hasText) {
        out.push({ role: 'system', content: text });
      }
      if (hasImages || hasToolCalls || toolResults.length > 0) {
        options.onWarning?.('Dropped unsupported non-text/non-user system parts for Mistral message.', {
          hasImages,
          hasToolCalls,
          toolResults: toolResults.length,
        });
      }
      continue;
    }

    let content: string | MistralContentPart[] | null | undefined;
    if (hasImages) {
      const multimodal: MistralContentPart[] = [];
      if (hasText) {
        multimodal.push({ type: 'text', text });
      }
      multimodal.push(...imageParts);
      content = multimodal;
    } else if (hasText) {
      content = text;
    } else if (message.role === 'assistant' && hasToolCalls) {
      content = null;
    }

    if (message.role === 'assistant') {
      if (content !== undefined || hasToolCalls) {
        out.push({
          role: 'assistant',
          content: content ?? null,
          ...(hasToolCalls ? { toolCalls } : {}),
        });
      }
    } else if (content !== undefined && content !== null) {
      out.push({ role: 'user', content });
    }

    for (const result of toolResults) {
      const toolName = toolNameById.get(result.callId);
      out.push({
        role: 'tool',
        content: result.content,
        toolCallId: result.callId,
        ...(typeof toolName === 'string' ? { name: toolName } : {}),
      });
    }
  }

  return out;
}
