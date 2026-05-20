// on-response.ts — Lifecycle hook: agent response capture
// Captures agent responses as episodic memories, tracks token usage

import type { MemoryEngine } from '../cognitive/memory-engine.js';

export interface OnResponseInput {
  engine: MemoryEngine;
  responseContent: string;
  responseTokens: number;
  modelFamily?: string;
}

export interface OnResponseOutput {
  memoryId: string | null;
  importance: number;
}

/**
 * Called after each agent response.
 * - Captures response content as episodic memory
 * - Assigns importance based on response length and model
 * - Flags high-importance responses for promotion
 */
export function onResponse(input: OnResponseInput): OnResponseOutput {
  const { engine, responseContent, responseTokens, modelFamily } = input;

  // Importance heuristic: longer, more substantial responses get higher scores
  let importance = 0.3;
  if (responseTokens > 500) importance = 0.5;
  if (responseTokens > 1000) importance = 0.6;
  if (responseTokens > 2000) importance = 0.7;

  // Build content — truncate to avoid bloat in sensory buffer
  const content =
    responseContent.length > 500
      ? `${responseContent.slice(0, 400)}...[${responseContent.length - 400} chars truncated]`
      : responseContent;

  const metadata: Record<string, unknown> = {};
  if (modelFamily) {
    metadata.modelFamily = modelFamily;
  }
  metadata.responseTokens = responseTokens;

  const memoryId = engine.ingest(content, {
    importance,
    kind: 'episodic',
    writeHeap: 'event',
    metadata
  });

  return { memoryId, importance };
}
