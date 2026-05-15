import { readFile, writeFile } from 'node:fs/promises';

export interface MemoryFileCompressionOptions {
  /**
   * Create a `.original.md` backup before rewriting the file.
   * Defaults to true to avoid accidental data loss when `writeCompressed` is enabled.
   */
  backup?: boolean;
  writeCompressed?: boolean;
}

export interface MemoryFileCompressionResult {
  original: string;
  compressed: string;
  savingsRatio: number;
  backupPath?: string;
}

const CODE_FENCE_PATTERN = /```[\s\S]*?```/g;

function compressPlainSegment(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];
  let lastComparable = '';
  let previousWasBlank = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const comparable = line.trim().toLowerCase();
    const isBlank = comparable.length === 0;

    if (isBlank) {
      if (!previousWasBlank) {
        output.push('');
      }
      previousWasBlank = true;
      continue;
    }

    previousWasBlank = false;

    // Preserve URLs and filesystem-like paths exactly.
    if (/https?:\/\//.test(line) || /(^|\s)(\.?\.?\/|~\/|\/[A-Za-z0-9._-])/.test(line)) {
      output.push(line);
      lastComparable = comparable;
      continue;
    }

    if (comparable === lastComparable) {
      continue;
    }

    lastComparable = comparable;
    output.push(line.replace(/\s{2,}/g, ' '));
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function compressMemoryContent(content: string): string {
  const chunks: Array<{ kind: 'text' | 'code'; value: string }> = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CODE_FENCE_PATTERN)) {
    const full = match[0];
    const start = match.index ?? lastIndex;
    const end = start + full.length;

    if (start > lastIndex) {
      chunks.push({ kind: 'text', value: content.slice(lastIndex, start) });
    }

    chunks.push({ kind: 'code', value: full });
    lastIndex = end;
  }

  if (lastIndex < content.length) {
    chunks.push({ kind: 'text', value: content.slice(lastIndex) });
  }

  return chunks
    .map(chunk => (chunk.kind === 'code' ? chunk.value : compressPlainSegment(chunk.value)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function compressMemoryFile(
  filePath: string,
  options: MemoryFileCompressionOptions = {}
): Promise<MemoryFileCompressionResult> {
  const original = await readFile(filePath, 'utf8');
  const compressed = compressMemoryContent(original);

  const originalLength = Math.max(1, original.length);
  const savingsRatio = Math.max(0, (originalLength - compressed.length) / originalLength);

  let backupPath: string | undefined;
  if (options.backup ?? true) {
    backupPath = `${filePath}.original.md`;
    await writeFile(backupPath, original, 'utf8');
  }

  if (options.writeCompressed === true) {
    await writeFile(filePath, compressed, 'utf8');
  }

  return {
    original,
    compressed,
    savingsRatio,
    ...(backupPath === undefined ? {} : { backupPath })
  };
}
