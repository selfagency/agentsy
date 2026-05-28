import { createHash } from 'node:crypto';

export interface ContextFingerprint {
  modelFamily: string;
  schemaVersion: number;
  templateVersion: string;
  value: string;
}

export interface CreateContextFingerprintInput {
  content: string;
  modelFamily: string;
  schemaVersion: number;
  templateVersion: string;
}

export interface MemoryReuseHint {
  invalidationKeys: string[];
  reuseClass: 'hot' | 'warm' | 'cold';
  stablePrefix: boolean;
  toolSchema: boolean;
}

export interface CreateMemoryReuseHintInput {
  invalidationKeys: string[];
  reuseClass: 'hot' | 'warm' | 'cold';
  stablePrefix: boolean;
  toolSchema: boolean;
}

export function createContextFingerprint(input: CreateContextFingerprintInput): ContextFingerprint {
  const source = [input.modelFamily, input.templateVersion, String(input.schemaVersion), input.content].join('|');
  const value = `sha256:${createHash('sha256').update(source).digest('hex')}`;

  return {
    modelFamily: input.modelFamily,
    schemaVersion: input.schemaVersion,
    templateVersion: input.templateVersion,
    value
  };
}

export function createMemoryReuseHint(input: CreateMemoryReuseHintInput): MemoryReuseHint {
  return {
    invalidationKeys: [...input.invalidationKeys],
    reuseClass: input.reuseClass,
    stablePrefix: input.stablePrefix,
    toolSchema: input.toolSchema
  };
}
