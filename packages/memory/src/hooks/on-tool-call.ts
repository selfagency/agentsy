// on-tool-call.ts — Lifecycle hook: tool call capture
// Automatically captures tool call results as sensory events

import type { MemoryEngine } from '../cognitive/memory-engine.js';

/** Heuristic importance multipliers by tool category */
const TOOL_IMPORTANCE: Record<string, number> = {
  write: 0.7,
  create: 0.7,
  update: 0.7,
  delete: 0.6,
  search: 0.3,
  read: 0.3,
  list: 0.2,
  get: 0.3,
  memory: 0.5
};

export interface OnToolCallInput {
  engine: MemoryEngine;
  importance?: number;
  toolInput: Record<string, unknown>;
  toolName: string;
  toolOutput: string;
}

export interface OnToolCallOutput {
  importance: number;
  memoryId: string | null;
}

/**
 * Called after each tool invocation during an agent session.
 * - Captures tool call results as sensory events
 * - Assigns importance based on tool type heuristics
 */
export function onToolCall(input: OnToolCallInput): OnToolCallOutput {
  const { engine, toolName, toolInput, toolOutput, importance } = input;

  // Compute importance: explicit override > heuristic > default 0.4
  let computedImportance = importance ?? 0.4;
  if (importance === undefined) {
    const lowerTool = toolName.toLowerCase();
    for (const [prefix, weight] of Object.entries(TOOL_IMPORTANCE)) {
      if (lowerTool.includes(prefix)) {
        computedImportance = weight;
        break;
      }
    }
  }

  // Build content from tool call
  const inputSummary = Object.entries(toolInput)
    .slice(0, 5) // limit to first 5 keys to avoid bloat
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v)}`)
    .join(', ');

  const content = `[tool:${toolName}] ${inputSummary} → ${toolOutput.slice(0, 300)}`;

  const memoryId = engine.ingest(content, {
    importance: computedImportance,
    kind: 'episodic',
    writeHeap: 'event'
  });

  return { memoryId, importance: computedImportance };
}
