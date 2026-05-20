import { fingerprintContent } from '../../content-addressing/fingerprint.js';
import type { MemoryItem } from '../tier-types.js';

export type ObservationKind = 'factual' | 'emotional' | 'procedural' | 'corrective' | 'relational';

export interface Observation {
  id: string;
  kind: ObservationKind;
  content: string;
  sourceMemoryId: string;
  confidence: number;
  contradictsWith: string[];
  supportsIds: string[];
  extractedAt: number;
}

export interface ObservationExtractor {
  extract(memoryItem: MemoryItem): Observation[];
  extractBatch(items: MemoryItem[]): Observation[];
}

export interface ObservationExtractorOptions {
  now?: (() => number) | undefined;
}

interface RawObservation {
  kind: ObservationKind;
  content: string;
  confidence: number;
}

// Heuristic extractors — pure functions mapping content string to raw observations

function extractFactual(content: string): RawObservation[] {
  const observations: RawObservation[] = [];
  // Match "X is Y" or "X are Y" patterns
  const isPattern = /\b([A-Z][A-Za-z0-9\s]{2,60})(?:\s+is\s+|\s+are\s+)([^.!?]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = isPattern.exec(content)) !== null) {
    const subject = match[1]?.trim();
    const predicate = match[2]?.trim();
    if (subject && predicate && predicate.length > 3) {
      observations.push({
        kind: 'factual',
        content: `${subject} is ${predicate}`,
        confidence: 0.7
      });
    }
  }
  return observations;
}

function extractEmotional(content: string): RawObservation[] {
  const observations: RawObservation[] = [];
  const emotionalPatterns = [
    { pattern: /\b(?:like|love|enjoy|prefer)\s+([^.,;]+)/giu, kind: 'factual' as ObservationKind, prefix: 'prefers' },
    {
      pattern: /\b(?:dislike|hate|avoid|do not want)\s+([^.,;]+)/giu,
      kind: 'emotional' as ObservationKind,
      prefix: 'dislikes'
    },
    {
      pattern: /\b(?:frustrated|annoyed|irritated)\s+(?:with|by|about)?\s*([^.,;]+)/giu,
      kind: 'emotional' as ObservationKind,
      prefix: 'frustrated with'
    },
    {
      pattern: /\b(?:happy|pleased|satisfied)\s+(?:with|about)?\s*([^.,;]+)/giu,
      kind: 'emotional' as ObservationKind,
      prefix: 'satisfied with'
    }
  ];

  for (const { pattern, kind, prefix } of emotionalPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const target = match[1]?.trim();
      if (target && target.length > 2) {
        observations.push({
          kind,
          content: `${prefix} ${target}`,
          confidence: 0.6
        });
      }
    }
  }
  return observations;
}

function extractProcedural(content: string): RawObservation[] {
  const observations: RawObservation[] = [];
  // Match "to do X, first Y then Z" or "step 1: ..." patterns
  const proceduralPattern =
    /\b(?:first|step\s*\d+|to\s+[^,]+,\s*(?:first|then|next|after)|how\s+to)\s+([^.;!?]{3,120})/giu;
  let match: RegExpExecArray | null;
  while ((match = proceduralPattern.exec(content)) !== null) {
    const step = match[1]?.trim();
    if (step && step.length > 5) {
      observations.push({
        kind: 'procedural',
        content: `procedure: ${step}`,
        confidence: 0.65
      });
    }
  }
  return observations;
}

function extractCorrective(content: string): RawObservation[] {
  const observations: RawObservation[] = [];
  // Match correction patterns: "previously thought X, actually Y" or "not X, but Y"
  const correctionPatterns = [
    /\b(?:previously|before|thought|believed)\s+([^,;]+)(?:[,;]\s*)?(?:but\s+now|actually|instead|correction)[,;:]?\s*([^.;!?]+)/giu,
    /\b(?:not|no longer)\s+([^,;]+)(?:[,;]\s*)?(?:but|rather|instead)[,;:]?\s*([^.;!?]+)/giu
  ];

  for (const pattern of correctionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const old = match[1]?.trim();
      const corrected = match[2]?.trim();
      if (old && corrected && old.length > 3 && corrected.length > 3) {
        observations.push({
          kind: 'corrective',
          content: `correction: "${old}" is actually "${corrected}"`,
          confidence: 0.75
        });
      }
    }
  }
  return observations;
}

function extractRelational(content: string): RawObservation[] {
  const observations: RawObservation[] = [];
  // Match "X met Y at Z" or "X works with Y" patterns
  const relationalPattern =
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:met|works with|collaborates with|knows|is related to)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\b/giu;
  let match: RegExpExecArray | null;
  while ((match = relationalPattern.exec(content)) !== null) {
    const from = match[1]?.trim();
    const to = match[2]?.trim();
    if (from && to && from !== to) {
      observations.push({
        kind: 'relational',
        content: `relationship: ${from} and ${to}`,
        confidence: 0.55
      });
    }
  }
  return observations;
}

const EXTRACTORS: ((content: string) => RawObservation[])[] = [
  extractFactual,
  extractEmotional,
  extractProcedural,
  extractCorrective,
  extractRelational
];

function deduplicateObservations(observations: RawObservation[]): RawObservation[] {
  const seen = new Set<string>();
  const result: RawObservation[] = [];
  for (const obs of observations) {
    const fp = fingerprintContent(obs.content).value;
    if (seen.has(fp)) continue;
    seen.add(fp);
    result.push(obs);
  }
  return result;
}

export function createObservationExtractor(options: ObservationExtractorOptions = {}): ObservationExtractor {
  const now = options.now ?? (() => performance.now());

  function extractSingle(memoryItem: MemoryItem): Observation[] {
    const allRaw: RawObservation[] = [];
    for (const extractor of EXTRACTORS) {
      allRaw.push(...extractor(memoryItem.content));
    }

    const deduped = deduplicateObservations(allRaw);
    const currentNow = now();

    return deduped.map((raw, index) => ({
      id: `obs-${memoryItem.id}-${index}`,
      kind: raw.kind,
      content: raw.content,
      sourceMemoryId: memoryItem.id,
      confidence: raw.confidence,
      contradictsWith: [],
      supportsIds: [],
      extractedAt: currentNow
    }));
  }

  return {
    extract(memoryItem: MemoryItem): Observation[] {
      return extractSingle(memoryItem);
    },

    extractBatch(items: MemoryItem[]): Observation[] {
      const results: Observation[] = [];
      for (const item of items) {
        results.push(...extractSingle(item));
      }
      return results;
    }
  };
}
