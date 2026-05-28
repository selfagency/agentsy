// on-session-start.ts — Lifecycle hook: agent session start
// Calls awaken() to process idle-time decay, loads hot memories for immediate injection

import type { AwakenResult, PendingEvent } from '../cognitive/awaken.js';
import type { MemoryEngine } from '../cognitive/memory-engine.js';
import type { MemoryItem, TierName } from '../cognitive/tier-types.js';

export interface OnSessionStartInput {
  engine: MemoryEngine;
  pendingEvents?: PendingEvent[];
  projectId?: string;
  userId?: string;
}

export interface OnSessionStartOutput {
  awakenResult: AwakenResult;
  budgetAvailable: number;
  durationMs: number;
  tierCapacity: Record<TierName, { used: number; max: number }>;
  warmMemories: MemoryItem[];
}

/**
 * Called when an agent session starts.
 * - Runs awaken() to process decay and consolidation
 * - Loads hot memories for immediate context injection
 * - Returns capacity/budget summary for the agent
 */
export async function onSessionStart(input: OnSessionStartInput): Promise<OnSessionStartOutput> {
  const start = performance.now();
  const { engine, pendingEvents } = input;

  // Run awaken to process decay and consolidation
  const awakenResult = await engine.awaken(pendingEvents);

  // Load hot memories from working memory and short-term memory for immediate context
  const recallResults = engine.recall({
    tiers: ['working_memory', 'short_term_memory', 'long_term_memory'],
    crossTier: true,
    minImportance: 0.5
  });

  const warmMemories: MemoryItem[] = [];
  for (const result of recallResults) {
    warmMemories.push(...result.items);
  }

  // Get capacity snapshot
  const snapshot = engine.snapshot();
  const tierCapacity = Object.fromEntries(
    Object.entries(snapshot.tiers).map(([name, data]) => [name, { used: data.usedTokens, max: data.maxTokens }])
  ) as Record<TierName, { used: number; max: number }>;

  const budgetAvailable = 1 - snapshot.budget.utilizationRatio;

  const durationMs = performance.now() - start;

  return {
    warmMemories,
    tierCapacity,
    budgetAvailable,
    awakenResult,
    durationMs
  };
}
