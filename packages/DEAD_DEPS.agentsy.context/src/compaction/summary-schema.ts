import type { ContentKind } from '../strategies/content-router.js';

export interface CompactionSummarySchemaEntry {
  id: string;
  kind: ContentKind;
  title: string;
}

export interface CompactionSummarySchema {
  decisions: CompactionSummarySchemaEntry[];
  focus: string;
  nextSteps: string[];
  sessionId: string;
}

export interface CompactionSummaryInput {
  focus: string;
  highlights?: readonly CompactionSummarySchemaEntry[];
  nextSteps?: readonly string[];
  sessionId: string;
}

export function createCompactionSummarySchema(input: CompactionSummaryInput): CompactionSummarySchema {
  return {
    decisions: [...(input.highlights ?? [])],
    focus: input.focus,
    nextSteps: [...(input.nextSteps ?? [])],
    sessionId: input.sessionId
  };
}
