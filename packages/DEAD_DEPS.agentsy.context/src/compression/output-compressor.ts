import type { CompressionLevel } from '@agentsy/core/context';
import { compressProse, protectPattern, restoreProtectedSegments } from '@agentsy/core/context';

export interface OutputPreserveOptions {
  codeFences: boolean;
  inlineCode: boolean;
  urls: boolean;
}

export interface OutputCompressionOptions {
  level?: CompressionLevel;
  preserve?: Partial<OutputPreserveOptions>;
}

export interface OutputCompressionMarker {
  id: string;
  kind: 'preserved-code' | 'preserved-url' | 'preserved-inline-code';
}

export interface OutputCompressionMetadata {
  markers: OutputCompressionMarker[];
}

export interface OutputCompressionDetailedResult {
  compressed: string;
  compressedTokens: number;
  metadata: OutputCompressionMetadata;
  original: string;
  originalTokens: number;
  savingsRatio: number;
}

export function createOutputCompressionMetadata(input: string): OutputCompressionMetadata {
  const markers: OutputCompressionMarker[] = [];

  if (/```/u.test(input)) {
    markers.push({ id: 'code-fence', kind: 'preserved-code' });
  }

  if (/https?:\/\/\S+/u.test(input)) {
    markers.push({ id: 'url', kind: 'preserved-url' });
  }

  if (/`[^`\n]+`/u.test(input)) {
    markers.push({ id: 'inline-code', kind: 'preserved-inline-code' });
  }

  return { markers };
}

const DEFAULT_PRESERVE: OutputPreserveOptions = {
  codeFences: true,
  inlineCode: true,
  urls: true
};

const PLACEHOLDER_PREFIX = '__AGENTSY_PRESERVE_';

function mergePreserveOptions(options?: Partial<OutputPreserveOptions>): OutputPreserveOptions {
  return {
    ...DEFAULT_PRESERVE,
    ...options
  };
}

export function compressOutputDetailed(
  input: string,
  options: OutputCompressionOptions = {}
): OutputCompressionDetailedResult {
  const level = options.level ?? 'full';
  const preserve = mergePreserveOptions(options.preserve);

  let working = input;

  if (!preserve.inlineCode) {
    working = working.replaceAll(/`([^`\n]+)`/gu, '$1');
  }

  if (!preserve.urls) {
    working = working.replaceAll(/https?:\/\/\S+/giu, 'link');
  }

  const placeholderMap = new Map<string, string>();
  const nextId = { value: 0 };

  if (preserve.codeFences) {
    working = protectPattern(working, /```[\s\S]*?```/gu, placeholderMap, nextId, PLACEHOLDER_PREFIX);
  }

  if (preserve.inlineCode) {
    working = protectPattern(working, /`[^`\n]+`/gu, placeholderMap, nextId, PLACEHOLDER_PREFIX);
  }

  if (preserve.urls) {
    working = protectPattern(working, /https?:\/\/\S+/giu, placeholderMap, nextId, PLACEHOLDER_PREFIX);
  }

  const compressed = restoreProtectedSegments(compressProse(working, level), placeholderMap);
  const originalTokens = Math.max(1, Math.ceil(input.length / 4));
  const compressedTokens = Math.max(1, Math.ceil(compressed.length / 4));

  return {
    compressed,
    compressedTokens,
    metadata: createOutputCompressionMetadata(input),
    original: input,
    originalTokens,
    savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens)
  };
}

export function compressOutput(input: string, options: OutputCompressionOptions = {}): string {
  return compressOutputDetailed(input, options).compressed;
}
