// createOutputCompressionMetadata — inlined from output-compressor.ts to avoid cross-package subpath dependency
import stopwords from './stopwords.json' with { type: 'json' };

interface OutputCompressionMarker {
  id: string;
  kind: 'preserved-code' | 'preserved-url' | 'preserved-inline-code';
}

interface OutputCompressionMetadata {
  markers: OutputCompressionMarker[];
}

function createOutputCompressionMetadata(input: string): OutputCompressionMetadata {
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

export type OutputCompressionLevel = 'lite' | 'full' | 'ultra';

export interface OutputCompressionOptions {
  intensity?: number;
  level: OutputCompressionLevel;
  preserve?: ('code' | 'technical' | 'urls' | 'paths' | 'markdown' | 'errors')[];
}

export interface OutputCompressionResult {
  compressed: string;
  compressedTokens: number;
  metadata?: {
    markers: Array<{ id: string; kind: 'preserved-code' | 'preserved-url' | 'preserved-inline-code' }>;
  };
  original: string;
  originalTokens: number;
  savingsRatio: number;
}

const CODE_FENCE_PATTERN = /```[\s\S]*?```/gu;
const DEFAULT_PRESERVATION_SET: ReadonlySet<string> = new Set(['code', 'urls', 'paths', 'markdown', 'errors']);
const FILLER_WORDS = new Set([
  'really',
  'very',
  'just',
  'actually',
  'basically',
  'simply',
  'quite',
  'definitely',
  'certainly',
  'absolutely',
  'clearly',
  'obviously',
  'perhaps',
  'maybe',
  'apparently',
  'evidently',
  'fortunately',
  'unfortunately',
  'however',
  'thus',
  'therefore',
  'moreover',
  'furthermore',
  'additionally',
  'also',
  'indeed',
  'otherwise',
  'meanwhile',
  'primarily',
  'largely',
  'mostly',
  'thoroughly',
  'remarkably',
  'practically',
  'exceptionally',
  'notably',
  'particularly',
  'significantly',
  'essentially',
  'fundamentally',
  'well',
  'rather',
  'somewhat',
  'fairly',
  'pretty',
  'awfully',
  'terribly',
  'super',
  'extremely'
]);
const STOP_WORDS = new Set(
  stopwords
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length > 0)
);

const REDUNDANT_PHRASES: readonly [RegExp, string][] = [
  [/\b(is\s+)?(really\s+)?(quite\s+)?(very\s+)?(basically|essentially|fundamentally|practically)\s+/giu, ''],
  [/\b(that|which)\s+is\s+(really|very|quite|basically)\s+/giu, 'that '],
  [/\bthe\s+reason\s+(is\s+)?(that|why)\s+/giu, 'because '],
  [/\bit\s+(seems|appears|looks|sounds)\s+(that\s+)?(really|very|quite)\s+/giu, ''],
  [/\bas\s+mentioned\b/giu, ''],
  [/\bas\s+you\s+may\s+know\b/giu, ''],
  [/\bin\s+conclusion/giu, 'Finally'],
  [/\bdue\s+to\s+the\s+fact\s+that\b/giu, 'because'],
  [/\bat\s+this\s+point\s+in\s+time\b/giu, 'now']
];

const ABBREVIATIONS: readonly [RegExp, string][] = [
  [/\bapproximately\b/giu, 'approx'],
  [/\bconfiguration\b/giu, 'config'],
  [/\binformation\b/giu, 'info'],
  [/\badministration\b/giu, 'admin'],
  [/\bdocumentation\b/giu, 'docs'],
  [/\bdirectory\b/giu, 'dir'],
  [/\bnumber\b/giu, '#'],
  [/\btechnology\b/giu, 'tech'],
  [/\bimplementation\b/giu, 'impl'],
  [/\boperation\b/giu, 'op'],
  [/\bgeneral\b/giu, 'gen']
];

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function applyReplacements(source: string, replacements: readonly [RegExp, string][]): string {
  let result = source;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

function normalizeAndDedupeLines(segment: string): string {
  const lines = segment.split('\n');
  const dedupedLines: string[] = [];
  let lastComparable = '';
  let previousWasBlank = false;

  for (const rawLine of lines) {
    const line = rawLine.replaceAll(/\s+/gu, ' ').trimEnd();
    const isBlank = line.trim().length === 0;

    if (isBlank) {
      if (!previousWasBlank) {
        dedupedLines.push('');
      }
      previousWasBlank = true;
      continue;
    }

    previousWasBlank = false;

    const comparable = line.trim().toLowerCase();
    if (comparable === lastComparable) {
      continue;
    }

    lastComparable = comparable;
    dedupedLines.push(line);
  }

  return dedupedLines.join('\n').trim();
}

function protectPreservedContent(
  source: string,
  preserve: ReadonlySet<string>
): { masked: string; restore: (value: string) => string } {
  const preserved: string[] = [];
  const stash = (value: string): string => {
    const index = preserved.push(value) - 1;
    return `__AGENTSY_PRESERVE_${index}__`;
  };

  let masked = source;

  if (preserve.has('urls')) {
    masked = masked.replaceAll(/https?:\/\/[^\s)]+/gu, stash);
  }

  if (preserve.has('paths')) {
    masked = masked.replaceAll(
      /(^|\s)(\.\.?\/|~\/|\/[A-Za-z0-9._/-]+)/gu,
      (_, prefix: string, path: string) => `${prefix}${stash(path)}`
    );
  }

  if (preserve.has('markdown')) {
    masked = masked.replaceAll(/`[^`]+`/gu, stash);
    masked = protectMarkdownLinks(masked, stash);
  }

  if (preserve.has('errors')) {
    masked = masked.replaceAll(/\b(?:error|exception|errno)[\s:#]*[A-Z0-9_-]+\b/giu, stash);
  }

  if (preserve.has('technical')) {
    masked = masked.replaceAll(/\b[A-Za-z_]+\([^)]*\)/gu, stash);
  }

  const restore = (value: string): string =>
    value.replaceAll(/__AGENTSY_PRESERVE_(\d+)__/gu, (_, indexRaw: string) => {
      const index = Number(indexRaw);
      return preserved[index] ?? '';
    });

  return { masked, restore };
}

function protectMarkdownLinks(source: string, stash: (value: string) => string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf('[', index);
    if (start === -1) {
      return result + source.slice(index);
    }

    const closeBracket = source.indexOf(']', start + 1);
    const openParen = closeBracket === -1 ? -1 : source.indexOf('(', closeBracket + 1);
    const closeParen = openParen === -1 ? -1 : source.indexOf(')', openParen + 1);

    if (closeBracket === -1 || openParen !== closeBracket + 1 || closeParen === -1) {
      result += source.slice(index, start + 1);
      index = start + 1;
      continue;
    }

    result += source.slice(index, start);
    result += stash(source.slice(start, closeParen + 1));
    index = closeParen + 1;
  }

  return result;
}

function stripFillerWords(source: string, strongOnly: boolean): string {
  const strongWords = new Set(['really', 'very', 'just', 'basically', 'simply']);
  return source
    .split(/(\s+)/u)
    .map(segment => {
      if (/^\s+$/u.test(segment) || segment.length === 0) {
        return segment;
      }

      const normalized = segment.toLowerCase();
      const isShortToken = normalized.length <= 2;
      const shouldRemove = strongOnly
        ? strongWords.has(normalized)
        : FILLER_WORDS.has(normalized) || (!isShortToken && STOP_WORDS.has(normalized));

      return shouldRemove ? '' : segment;
    })
    .join('');
}

function finalizeWhitespace(source: string): string {
  return source.replaceAll(/\s{2,}/gu, ' ').trim();
}

function compressNonCodeSegment(segment: string, level: OutputCompressionLevel, preserve: ReadonlySet<string>): string {
  const joined = normalizeAndDedupeLines(segment);
  if (joined.length === 0) {
    return '';
  }

  const { masked, restore } = protectPreservedContent(joined, preserve);

  switch (level) {
    case 'lite': {
      const result = finalizeWhitespace(stripFillerWords(masked, true));
      return restore(result);
    }

    case 'full': {
      const withoutFiller = stripFillerWords(masked, false);
      const reduced = applyReplacements(withoutFiller, REDUNDANT_PHRASES);
      return restore(finalizeWhitespace(reduced));
    }

    case 'ultra': {
      const withoutFiller = stripFillerWords(masked, false);
      const reduced = normalizeUltraText(applyReplacements(withoutFiller, REDUNDANT_PHRASES));
      const abbreviated = applyReplacements(reduced, ABBREVIATIONS).replaceAll(
        /\b(?:the|a|an)\s+([a-z]+)\b/giu,
        (_, adjective: string) => `${adjective} `
      );

      return restore(
        abbreviated
          .replaceAll(/\s{2,}/gu, ' ')
          .replaceAll(/ ([,.])/gu, '$1')
          .trim()
      );
    }
    default: {
      return segment;
    }
  }
}

function normalizeUltraText(source: string): string {
  let output = source.replaceAll(/\b(and|or)\s+\1\s+/giu, '$1 ').replaceAll(/\b(is|are|was|were)\s+quite\s+/giu, '');

  output = removeWhichClauses(output);
  return output.replaceAll(/ ([,.?!])/gu, '$1');
}

function removeWhichClauses(source: string): string {
  const needle = ', which ';
  let index = 0;
  let output = '';

  while (index < source.length) {
    const matchIndex = source.toLowerCase().indexOf(needle, index);
    if (matchIndex === -1) {
      return output + source.slice(index);
    }

    output += source.slice(index, matchIndex);

    let clauseEnd = matchIndex + needle.length;
    while (clauseEnd < source.length && !',.?!'.includes(source[clauseEnd] ?? '')) {
      clauseEnd += 1;
    }

    if (clauseEnd < source.length) {
      output += source[clauseEnd];
      index = clauseEnd + 1;
    } else {
      index = clauseEnd;
    }
  }

  return output;
}

export function compressOutput(response: string, options: OutputCompressionOptions): OutputCompressionResult {
  const preserve = new Set(options.preserve ?? [...DEFAULT_PRESERVATION_SET]);
  const { level } = options;
  const metadata = createOutputCompressionMetadata(response);

  if (!preserve.has('code')) {
    const originalTokens = estimateTextTokens(response);
    const compressed = compressNonCodeSegment(response, level, preserve);
    const compressedTokens = estimateTextTokens(compressed);
    return {
      compressed,
      compressedTokens,
      metadata,
      original: response,
      originalTokens,
      savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens)
    };
  }

  const segments: { kind: 'code' | 'text'; value: string }[] = [];
  let lastIndex = 0;

  for (const match of response.matchAll(CODE_FENCE_PATTERN)) {
    const full = match[0];
    const start = match.index ?? lastIndex;
    const end = start + full.length;

    if (start > lastIndex) {
      segments.push({ kind: 'text', value: response.slice(lastIndex, start) });
    }

    segments.push({ kind: 'code', value: full });
    lastIndex = end;
  }

  if (lastIndex < response.length) {
    segments.push({ kind: 'text', value: response.slice(lastIndex) });
  }

  const compressed = segments
    .map(segment => (segment.kind === 'code' ? segment.value : compressNonCodeSegment(segment.value, level, preserve)))
    .join('\n')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();

  const originalTokens = estimateTextTokens(response);
  const compressedTokens = estimateTextTokens(compressed);

  return {
    compressed,
    compressedTokens,
    metadata,
    original: response,
    originalTokens,
    savingsRatio: originalTokens === 0 ? 0 : Math.max(0, (originalTokens - compressedTokens) / originalTokens)
  };
}
