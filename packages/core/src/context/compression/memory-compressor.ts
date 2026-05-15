import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { CompressionLevel } from './prose-compressor.js';
import { compressProse, protectPattern, restoreProtectedSegments } from './prose-compressor.js';

export type MemoryCompressionLevel = CompressionLevel;

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
const PLACEHOLDER_PREFIX = '__AGENTSY_MEMORY_PRESERVE_';

function compressContent(input: string, level: MemoryCompressionLevel): string {
  const placeholderMap = new Map<string, string>();
  const nextId = { value: 0 };

  let working = input;
  working = protectPattern(working, /```[\s\S]*?```/g, placeholderMap, nextId, PLACEHOLDER_PREFIX);
  working = protectPattern(working, /`[^`\n]+`/g, placeholderMap, nextId, PLACEHOLDER_PREFIX);
  working = protectPattern(working, /https?:\/\/\S+/gi, placeholderMap, nextId, PLACEHOLDER_PREFIX);

  const compressed = compressProse(working, level);
  return restoreProtectedSegments(compressed, placeholderMap);
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
    backupPath = `${filePath}.original`;
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
