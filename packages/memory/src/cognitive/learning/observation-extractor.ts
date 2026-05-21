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

type ExtractorFn = (content: string) => RawObservation[];

function extractByPattern(
  content: string,
  pattern: RegExp,
  build: (match: RegExpExecArray) => RawObservation | null
): RawObservation[] {
  const observations: RawObservation[] = [];
  let match = pattern.exec(content);
  while (match !== null) {
    const obs = build(match);
    if (obs) observations.push(obs);
    match = pattern.exec(content);
  }
  return observations;
}

// Heuristic extractors — pure functions mapping content string to raw observations

function extractFactual(content: string): RawObservation[] {
  const isPattern = /\b([A-Z][A-Za-z0-9\s]{2,60})(?:\s+is\s+|\s+are\s+)([^.!?]+)/gu;
  return extractByPattern(content, isPattern, (match: RegExpExecArray) => {
    const subject = match[1]?.trim();
    const predicate = match[2]?.trim();
    if (!subject || !predicate || predicate.length <= 3) return null;
    return {
      kind: 'factual',
      content: `${subject} is ${predicate}`,
      confidence: 0.7
    };
  });
}

function extractEmotional(content: string): RawObservation[] {
  const emotionalPatterns: {
    pattern: RegExp;
    kind: ObservationKind;
    prefix: string;
  }[] = [
    {
      pattern: /\b(?:like|love|enjoy|prefer)\s+([^.,;]+)/giu,
      kind: 'factual',
      prefix: 'prefers'
    },
    {
      pattern: /\b(?:dislike|hate|avoid|do not want)\s+([^.,;]+)/giu,
      kind: 'emotional',
      prefix: 'dislikes'
    },
    {
      pattern: /\b(?:frustrated|annoyed|irritated)\s+(?:with|by|about)?\s*([^.,;]+)/giu,
      kind: 'emotional',
      prefix: 'frustrated with'
    },
    {
      pattern: /\b(?:happy|pleased|satisfied)\s+(?:with|about)?\s*([^.,;]+)/giu,
      kind: 'emotional',
      prefix: 'satisfied with'
    }
  ];

  const observations: RawObservation[] = [];
  for (const { pattern, kind, prefix } of emotionalPatterns) {
    observations.push(
      ...extractByPattern(content, pattern, (match: RegExpExecArray) => {
        const target = match[1]?.trim();
        if (!target || target.length <= 2) return null;
        return { kind, content: `${prefix} ${target}`, confidence: 0.6 };
      })
    );
  }
  return observations;
}

function extractProcedural(content: string): RawObservation[] {
  const stepPattern = /\b(?:first|then|next|after)\s+([^.;!?]{3,120})/giu;
  const howToPattern = /\bhow\s+to\s+([^.;!?]{3,120})/giu;

  const build = (match: RegExpExecArray): RawObservation | null => {
    const step = match[1]?.trim();
    if (!step || step.length <= 5) return null;
    return {
      kind: 'procedural',
      content: `procedure: ${step}`,
      confidence: 0.65
    };
  };

  return [...extractByPattern(content, stepPattern, build), ...extractByPattern(content, howToPattern, build)];
}

function extractCorrective(content: string): RawObservation[] {
  const correctionPatterns = [
    /\b(?:previously|before|thought|believed)\s+([^,;]+)(?:[,;]\s*)?(?:but\s+now|actually|instead|correction)[,;:]?\s*([^.;!?]+)/giu,
    /\b(?:not|no longer)\s+([^,;]+)(?:[,;]\s*)?(?:but|rather|instead)[,;:]?\s*([^.;!?]+)/giu
  ];

  const observations: RawObservation[] = [];
  for (const pattern of correctionPatterns) {
    observations.push(
      ...extractByPattern(content, pattern, (match: RegExpExecArray) => {
        const old = match[1]?.trim();
        const corrected = match[2]?.trim();
        if (!old || !corrected || old.length <= 3 || corrected.length <= 3) return null;
        return {
          kind: 'corrective',
          content: `correction: "${old}" is actually "${corrected}"`,
          confidence: 0.75
        };
      })
    );
  }
  return observations;
}

function extractRelational(content: string): RawObservation[] {
  const relationalPattern =
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+(?:met|works with|collaborates with|knows|is related to)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\b/giu;
  return extractByPattern(content, relationalPattern, (match: RegExpExecArray) => {
    const from = match[1]?.trim();
    const to = match[2]?.trim();
    if (!from || !to || from === to) return null;
    return {
      kind: 'relational',
      content: `relationship: ${from} and ${to}`,
      confidence: 0.55
    };
  });
}

const EXTRACTORS: ExtractorFn[] = [
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
