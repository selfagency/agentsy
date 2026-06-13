/**
 * Discriminated union memory entries.
 *
 * Each entry carries a literal `type` discriminator so a single `remember()`
 * function dispatches typed payloads to the correct storage backend without
 * type-checking branches. Inspired by cognee's QAEntry, TraceEntry,
 * FeedbackEntry, and SkillRunEntry.
 */

/** User preference, entity, procedure, or constraint extracted from conversation. */
export interface FactObservationEntry {
  confidence: number;
  content: string;
  kind: 'user_preference' | 'entity' | 'procedure' | 'constraint' | 'task_context';
  type: 'fact';
}

/** A question-and-answer turn in a session. */
export interface QATurnEntry {
  answer: string;
  context?: string;
  feedbackScore?: number;
  question: string;
  type: 'qa';
  usedGraphElementIds?: string[];
}

/** A tool call trace step in an agent session. */
export interface TraceStepEntry {
  args: Record<string, unknown>;
  errorMessage?: string;
  result: unknown;
  status: 'success' | 'error';
  toolName: string;
  type: 'trace';
}

/** User feedback attached to a previous QA entry. */
export interface FeedbackEntry {
  feedbackScore: number;
  feedbackText: string;
  qaId: string;
  type: 'feedback';
}

/** Record of a skill execution. */
export interface SkillRunEntry {
  latencyMs: number;
  resultSummary: string;
  skillId: string;
  successScore: number;
  task: string;
  type: 'skill_run';
}

/** Union of all memory entry types — discriminated by `type`. */
export type MemoryEntry = FactObservationEntry | QATurnEntry | TraceStepEntry | FeedbackEntry | SkillRunEntry;

/**
 * Provenance source discriminator for recall results.
 */
export type EntrySource = 'session' | 'graph' | 'trace';

/**
 * Validate that an unknown object is a valid MemoryEntry.
 */
export function isMemoryEntry(value: unknown): value is MemoryEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  const type = entry.type;
  return type === 'fact' || type === 'qa' || type === 'trace' || type === 'feedback' || type === 'skill_run';
}

/**
 * Score a MemoryEntry for importance-based tier promotion.
 */
export function entryImportance(entry: MemoryEntry): number {
  switch (entry.type) {
    case 'feedback':
      return Math.min(1, Math.abs(entry.feedbackScore) / 10);
    case 'qa':
      return entry.feedbackScore === undefined ? 0.7 : Math.min(1, entry.feedbackScore / 10);
    case 'trace':
      return entry.status === 'error' ? 0.9 : 0.5;
    case 'fact':
      return entry.confidence;
    case 'skill_run':
      return entry.successScore;
    default:
      return 0.5;
  }
}
