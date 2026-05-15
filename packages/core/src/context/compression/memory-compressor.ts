import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

export type MemoryCompressionLevel = 'lite' | 'full' | 'ultra';

export interface MemoryCompressionOptions {
  level?: MemoryCompressionLevel;
  backup?: boolean;
}

export interface MemoryCompressionResult {
  original: string;
  compressed: string;
  originalChars: number;
  compressedChars: number;
  savingsRatio: number;
  backupPath?: string;
}

const SENSITIVE_NAME_TOKENS = [
  'secret',
  'credential',
  'password',
  'passwd',
  'apikey',
  'accesskey',
  'token',
  'privatekey',
];
const SENSITIVE_PATH_SEGMENTS = ['/.ssh/', '/.aws/', '/.gnupg/', '/.kube/', '/.docker/'];
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.crt', '.jks']);
const SENSITIVE_FILENAMES = new Set(['.env', '.netrc', 'id_rsa', 'authorized_keys', 'known_hosts']);

const LITE_REMOVALS = ['basically', 'actually', 'simply', 'really', 'just', 'generally', 'essentially'];
const FULL_REMOVALS = [...LITE_REMOVALS, 'furthermore', 'additionally', 'however', 'of course'];
const ULTRA_REMOVALS = [...FULL_REMOVALS, 'you should', 'it might be worth', 'you could consider'];
const PLACEHOLDER_PREFIX = '__AGENTSY_MEMORY_PRESERVE_';

function removeWordList(input: string, words: readonly string[]): string {
  let output = input;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
  }

  return output;
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

function compressContent(input: string, level: MemoryCompressionLevel): string {
  const removals = level === 'lite' ? LITE_REMOVALS : level === 'full' ? FULL_REMOVALS : ULTRA_REMOVALS;

  const placeholderMap = new Map<string, string>();
  const nextId = { value: 0 };

  let working = input;
  working = protectPattern(working, /```[\s\S]*?```/g, placeholderMap, nextId);
  working = protectPattern(working, /`[^`\n]+`/g, placeholderMap, nextId);
  working = protectPattern(working, /https?:\/\/\S+/gi, placeholderMap, nextId);

  working = removeWordList(working, removals);

  if (level !== 'lite') {
    working = working.replace(/\b(a|an|the)\b/gi, '');
  }

  if (level === 'ultra') {
    working = working
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bmake sure to\b/gi, 'ensure')
      .replace(/\bthat\b/gi, '');
  }

  working = working
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  return restoreProtectedSegments(working, placeholderMap);
}

export function isSensitivePath(filePath: string): boolean {
  const lowered = filePath.toLowerCase().replaceAll('\\\\', '/');
  const name = basename(lowered);
  const extension = extname(lowered);

  if (SENSITIVE_FILENAMES.has(name)) {
    return true;
  }

  if (name.startsWith('.env')) {
    return true;
  }

  if (SENSITIVE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (SENSITIVE_PATH_SEGMENTS.some(segment => lowered.includes(segment))) {
    return true;
  }

  return SENSITIVE_NAME_TOKENS.some(token => name.includes(token));
}

export async function compressMemoryFile(
  filePath: string,
  options: MemoryCompressionOptions = {},
): Promise<MemoryCompressionResult> {
  if (isSensitivePath(filePath)) {
    throw new Error(`Refusing to compress sensitive path: ${filePath}`);
  }

  const level = options.level ?? 'full';
  const original = await readFile(filePath, 'utf8');
  const compressed = compressContent(original, level);

  let backupPath: string | undefined;
  if (options.backup ?? true) {
    backupPath = `${filePath}.original.md`;
    await copyFile(filePath, backupPath);
  }

  await writeFile(filePath, compressed, 'utf8');

  const originalChars = original.length;
  const compressedChars = compressed.length;
  const savingsRatio = originalChars === 0 ? 0 : (originalChars - compressedChars) / originalChars;

  return {
    original,
    compressed,
    originalChars,
    compressedChars,
    savingsRatio,
    ...(backupPath === undefined ? {} : { backupPath }),
  };
}
