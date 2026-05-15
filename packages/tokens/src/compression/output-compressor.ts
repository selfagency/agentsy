export type CompressionLevel = 'lite' | 'full' | 'ultra';

export interface OutputPreserveOptions {
  codeFences: boolean;
  inlineCode: boolean;
  urls: boolean;
}

export interface OutputCompressionOptions {
  level?: CompressionLevel;
  preserve?: Partial<OutputPreserveOptions>;
}

const DEFAULT_PRESERVE: OutputPreserveOptions = {
  codeFences: true,
  inlineCode: true,
  urls: true,
};

const LITE_REMOVALS = ['basically', 'actually', 'simply', 'really', 'just', 'generally', 'essentially'];

const FULL_REMOVALS = [...LITE_REMOVALS, 'furthermore', 'additionally', 'however', 'of course'];

const ULTRA_REMOVALS = [...FULL_REMOVALS, 'you should', 'it might be worth', 'you could consider'];

const PLACEHOLDER_PREFIX = '__AGENTSY_PRESERVE_';

function mergePreserveOptions(options?: Partial<OutputPreserveOptions>): OutputPreserveOptions {
  return {
    ...DEFAULT_PRESERVE,
    ...options,
  };
}

function protectPattern(
  input: string,
  pattern: RegExp,
  placeholderMap: Map<string, string>,
  nextId: { value: number },
): string {
  return input.replace(pattern, match => {
    const key = `${PLACEHOLDER_PREFIX}${nextId.value}__`;
    nextId.value += 1;
    placeholderMap.set(key, match);
    return key;
  });
}

function restoreProtectedSegments(input: string, placeholderMap: Map<string, string>): string {
  let output = input;
  for (const [key, value] of placeholderMap.entries()) {
    output = output.replaceAll(key, value);
  }

  return output;
}

function removeWordList(input: string, words: readonly string[]): string {
  let output = input;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
  }

  return output;
}

function compressProse(input: string, level: CompressionLevel): string {
  const removals = level === 'lite' ? LITE_REMOVALS : level === 'full' ? FULL_REMOVALS : ULTRA_REMOVALS;

  let output = removeWordList(input, removals);

  if (level !== 'lite') {
    output = output.replace(/\b(a|an|the)\b/gi, '');
  }

  if (level === 'ultra') {
    output = output
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bmake sure to\b/gi, 'ensure')
      .replace(/\bthat\b/gi, '');
  }

  output = output
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  return output;
}

export function compressOutput(input: string, options: OutputCompressionOptions = {}): string {
  const level = options.level ?? 'full';
  const preserve = mergePreserveOptions(options.preserve);

  let working = input;

  if (!preserve.inlineCode) {
    working = working.replace(/`([^`\n]+)`/g, '$1');
  }

  if (!preserve.urls) {
    working = working.replace(/https?:\/\/\S+/gi, 'link');
  }

  const placeholderMap = new Map<string, string>();
  const nextId = { value: 0 };

  if (preserve.codeFences) {
    working = protectPattern(working, /```[\s\S]*?```/g, placeholderMap, nextId);
  }

  if (preserve.inlineCode) {
    working = protectPattern(working, /`[^`\n]+`/g, placeholderMap, nextId);
  }

  if (preserve.urls) {
    working = protectPattern(working, /https?:\/\/\S+/gi, placeholderMap, nextId);
  }

  const compressed = compressProse(working, level);
  return restoreProtectedSegments(compressed, placeholderMap);
}
