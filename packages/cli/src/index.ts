import { readFile } from 'node:fs/promises';

import { compressMemoryFile } from '@agentsy/core/context';
import { compressOutput, type OutputCompressionLevel } from '@agentsy/tokens';

export const name = 'cli';

export interface CliIO {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

const DEFAULT_IO: Required<CliIO> = {
  stdout: message => {
    console.log(message);
  },
  stderr: message => {
    console.error(message);
  }
};

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }

  return args[index + 1] ?? null;
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function toCompressionLevel(value: string | null): OutputCompressionLevel | null {
  if (value === 'lite' || value === 'full' || value === 'ultra') {
    return value;
  }

  if (value === null) {
    return 'full';
  }

  return null;
}

export async function runCli(argv: readonly string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const [command, ...rest] = argv;

  if (command === 'compress') {
    const filePath = getFlagValue(rest, '--file');
    const text = getFlagValue(rest, '--text');
    const level = toCompressionLevel(getFlagValue(rest, '--level'));

    if (level === null) {
      (io.stderr ?? DEFAULT_IO.stderr)('Invalid --level value. Use one of: lite, full, ultra.');
      return 1;
    }

    if (filePath === null && text === null) {
      (io.stderr ?? DEFAULT_IO.stderr)('Missing input. Provide --text or --file.');
      return 1;
    }

    const source = text ?? (filePath === null ? '' : await readFile(filePath, 'utf8'));
    const result = compressOutput(source, { level });
    (io.stdout ?? DEFAULT_IO.stdout)(result.compressed);
    (io.stdout ?? DEFAULT_IO.stdout)(`Savings: ${(result.savingsRatio * 100).toFixed(2)}%`);
    return 0;
  }

  if (command === 'compress-memory') {
    const filePath = getFlagValue(rest, '--file');
    if (filePath === null) {
      (io.stderr ?? DEFAULT_IO.stderr)('Missing --file for compress-memory command.');
      return 1;
    }

    const backup = !hasFlag(rest, '--no-backup');

    const result = await compressMemoryFile(filePath, {
      backup
    });
    (io.stdout ?? DEFAULT_IO.stdout)(`Compressed ${filePath}`);
    (io.stdout ?? DEFAULT_IO.stdout)(`Savings: ${(result.savingsRatio * 100).toFixed(2)}%`);
    return 0;
  }

  (io.stderr ?? DEFAULT_IO.stderr)(`Unknown command: ${command ?? '(none)'}`);
  (io.stderr ?? DEFAULT_IO.stderr)('Supported commands: compress, compress-memory');
  return 1;
}
