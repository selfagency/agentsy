import { createHash } from 'node:crypto';

export interface ContextFingerprint {
  value: string;
  modelFamily: string;
  templateVersion: string;
  schemaVersion: number;
}

export interface ContextSegment {
  content: string;
  fingerprint: ContextFingerprint;
  reuseClass: 'hot' | 'warm' | 'cold';
  invalidations: string[];
}

export interface BuildContextSegmentsInput {
  systemPrompt: string;
  toolSchema?: Record<string, unknown>;
  memorySummary?: string;
  modelFamily: string;
  templateVersion: string;
}

function fingerprintValue(parts: (string | undefined)[]): string {
  const source = parts.filter((part): part is string => part !== undefined).join('|');
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

function buildFingerprint(
  modelFamily: string,
  templateVersion: string,
  schemaVersion: number,
  content: string
): ContextFingerprint {
  return {
    modelFamily,
    schemaVersion,
    templateVersion,
    value: fingerprintValue([modelFamily, templateVersion, String(schemaVersion), content])
  };
}

export function buildContextSegments(input: BuildContextSegmentsInput): ContextSegment[] {
  const invalidations = [`model-family:${input.modelFamily}`, `template:${input.templateVersion}`];
  const segments: ContextSegment[] = [
    {
      content: input.systemPrompt,
      fingerprint: buildFingerprint(input.modelFamily, input.templateVersion, 1, `system:${input.systemPrompt}`),
      invalidations,
      reuseClass: 'hot'
    }
  ];

  if (input.toolSchema !== undefined) {
    segments.push({
      content: JSON.stringify(input.toolSchema),
      fingerprint: buildFingerprint(
        input.modelFamily,
        input.templateVersion,
        1,
        `toolSchema:${JSON.stringify(input.toolSchema)}`
      ),
      invalidations: [...invalidations, 'tool-schema'],
      reuseClass: 'warm'
    });
  }

  if (input.memorySummary !== undefined) {
    segments.push({
      content: input.memorySummary,
      fingerprint: buildFingerprint(input.modelFamily, input.templateVersion, 1, `memory:${input.memorySummary}`),
      invalidations: [...invalidations, 'memory-summary'],
      reuseClass: 'warm'
    });
  }

  return segments;
}
