import { readFile } from 'node:fs/promises';

import { compressMemoryFile } from '@agentsy/core/context';
import { compressOutput } from '@agentsy/tokens';

export const name = 'cli';

export interface CliIo {
  stdout?: (value: string) => void;
  stderr?: (value: string) => void;
}

function readFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  return argv[index + 1];
}

function writeOut(io: CliIo, value: string): void {
  if (io.stdout) {
    io.stdout(value);
    return;
  }

  process.stdout.write(`${value}\n`);
}

function writeErr(io: CliIo, value: string): void {
  if (io.stderr) {
    io.stderr(value);
    return;
  }

  process.stderr.write(`${value}\n`);
}

export async function runCli(argv: readonly string[], io: CliIo = {}): Promise<number> {
  const [command] = argv;

  if (command === 'compress') {
    const level = (readFlagValue(argv, '--level') ?? 'full') as 'lite' | 'full' | 'ultra';
    const filePath = readFlagValue(argv, '--file');
    const text = readFlagValue(argv, '--text');

    if (!filePath && !text) {
      writeErr(io, 'Missing input. Provide --text or --file.');
      return 1;
    }

    const source = text ?? (await readFile(filePath as string, 'utf8'));
    const result = compressOutput(source, { level });
    writeOut(io, result.compressed);
    writeOut(io, `Savings: ${(result.savingsRatio * 100).toFixed(2)}%`);
    return 0;
  }

  if (command === 'compress-memory') {
    const filePath = readFlagValue(argv, '--file');
    if (!filePath) {
      writeErr(io, 'Missing --file for compress-memory command.');
      return 1;
    }

    const result = await compressMemoryFile(filePath, {
      backup: true,
      writeCompressed: true,
    });

    writeOut(io, `Compressed ${filePath}`);
    writeOut(io, `Savings: ${(result.savingsRatio * 100).toFixed(2)}%`);
    return 0;
  }

  writeErr(io, 'Unknown command. Supported commands: compress, compress-memory');
  return 1;
}
