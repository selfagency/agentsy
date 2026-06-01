import type { StreamChunk } from '@agentsy/core/processor';

import type { LanguageModelChatResponseChunk } from '../provider/index.js';

/**
 * Maps a canonical @agentsy/processor StreamChunk to a VS Code-compatible delta.
 * Handles text, reasoning (as text/think tags), and native tool calls.
 */
export function mapStreamChunkToVsCode(chunk: StreamChunk): LanguageModelChatResponseChunk[] {
  const parts: LanguageModelChatResponseChunk[] = [];

  // Add text content if present
  if (chunk.content) {
    parts.push({
      part: {
        type: 'text',
        value: chunk.content
      }
    });
  }

  // Add reasoning (thinking) as text or custom think tags
  // VS Code doesn't have a native 'thinking' part yet, so we surface it as text.
  if (chunk.thinking) {
    parts.push({
      part: {
        type: 'text',
        value: `<think>${chunk.thinking}</think>\n`
      }
    });
  }

  // Add native tool call deltas
  if (chunk.nativeToolCallDeltas) {
    for (const delta of chunk.nativeToolCallDeltas) {
      parts.push({
        part: {
          callId: delta.id,
          index: delta.index,
          input: delta.argumentsDelta,
          name: delta.name,
          type: 'tool-call'
        }
      });
    }
  }

  return parts;
}
