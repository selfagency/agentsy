import { readFile } from 'node:fs/promises';

import { compressMemoryFile } from '@agentsy/core/context';
import { compressOutput, type CompressionLevel } from '@agentsy/tokens';

export const name = 'cli';

export interface CliIO {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

const DEFAULT_IO: CliIO = {
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

function toCompressionLevel(value: string | null): CompressionLevel {
  if (value === 'lite' || value === 'full' || value === 'ultra') {
    return value;
  }

  return 'full';
}

export async function runCli(argv: readonly string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const [command, ...rest] = argv;

  if (command === 'compress') {
    const filePath = getFlagValue(rest, '--file');
    if (filePath === null) {
      io.stderr('Missing required flag: --file');
      return 1;
    }

    const level = toCompressionLevel(getFlagValue(rest, '--level'));
    const original = await readFile(filePath, 'utf8');
    const compressed = compressOutput(original, { level });
    io.stdout(compressed);
    return 0;
  }

  if (command === 'compress-memory') {
    const filePath = getFlagValue(rest, '--file');
    if (filePath === null) {
      io.stderr('Missing required flag: --file');
      return 1;
    }

    const backup = !hasFlag(rest, '--no-backup');

    const result = await compressMemoryFile(filePath, {
      backup,
      writeCompressed: true,
    });
    io.stdout(`Compressed ${filePath}`);
    io.stdout(`Savings: ${(result.savingsRatio * 100).toFixed(2)}%`);
    return 0;
  }

  io.stderr(`Unknown command: ${command ?? '(none)'}`);
  io.stderr('Supported commands: compress, compress-memory');
  return 1;
}
