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

interface MemorySyncDevExample {
  serverDbPath: string;
  replicaDbPath: string;
  bindAddress: string;
  serverUrl: string;
  syncIntervalMs: number;
  startCommand: string;
  env: {
    TURSO_DATABASE_URL: string;
    TURSO_AUTH_TOKEN: string;
    AGENTSY_MEMORY_SYNC_INTERVAL_MS: string;
  };
  managerExample: string;
}

const DEFAULT_MEMORY_SYNC_SERVER_DB = './.agentsy/local-sync-server.db';
const DEFAULT_MEMORY_SYNC_REPLICA_DB = './.agentsy/local-replica.db';
const DEFAULT_MEMORY_SYNC_BIND = '0.0.0.0:8080';
const DEFAULT_MEMORY_SYNC_URL = 'http://localhost:8080';
const DEFAULT_MEMORY_SYNC_INTERVAL_MS = 5_000;

function getNumberFlagValue(args: readonly string[], flag: string, fallback: number): number | null {
  const raw = getFlagValue(args, flag);
  if (raw === null) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function createMemorySyncDevExample(args: readonly string[]): MemorySyncDevExample | null {
  const syncIntervalMs = getNumberFlagValue(args, '--sync-interval-ms', DEFAULT_MEMORY_SYNC_INTERVAL_MS);
  if (syncIntervalMs === null) {
    return null;
  }

  const serverDbPath = getFlagValue(args, '--server-db') ?? DEFAULT_MEMORY_SYNC_SERVER_DB;
  const replicaDbPath = getFlagValue(args, '--replica-db') ?? DEFAULT_MEMORY_SYNC_REPLICA_DB;
  const bindAddress = getFlagValue(args, '--bind') ?? DEFAULT_MEMORY_SYNC_BIND;
  const serverUrl = getFlagValue(args, '--server-url') ?? DEFAULT_MEMORY_SYNC_URL;
  const startCommand = `tursodb ${serverDbPath} --sync-server ${bindAddress}`;

  return {
    serverDbPath,
    replicaDbPath,
    bindAddress,
    serverUrl,
    syncIntervalMs,
    startCommand,
    env: {
      TURSO_DATABASE_URL: serverUrl,
      TURSO_AUTH_TOKEN: '',
      AGENTSY_MEMORY_SYNC_INTERVAL_MS: String(syncIntervalMs)
    },
    managerExample: [
      "import { createTursoManager } from '@agentsy/memory';",
      '',
      'const manager = createTursoManager({',
      `  path: '${replicaDbPath}',`,
      `  databaseUrl: '${serverUrl}',`,
      "  authToken: '',",
      `  syncIntervalMs: ${syncIntervalMs},`,
      '  maxRetries: 3,',
      "  mode: 'remote-shadow'",
      '});'
    ].join('\n')
  };
}

function formatMemorySyncDevExample(example: MemorySyncDevExample): string[] {
  return [
    'Local Turso sync server development wiring',
    '',
    'Start the local sync server:',
    example.startCommand,
    '',
    'Environment:',
    `TURSO_DATABASE_URL=${example.env.TURSO_DATABASE_URL}`,
    'TURSO_AUTH_TOKEN=',
    `AGENTSY_MEMORY_SYNC_INTERVAL_MS=${example.env.AGENTSY_MEMORY_SYNC_INTERVAL_MS}`,
    '',
    'No auth token is needed for the local sync server.',
    '',
    'Example @agentsy/memory setup:',
    example.managerExample
  ];
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

  if (command === 'memory-sync-dev') {
    const example = createMemorySyncDevExample(rest);
    if (example === null) {
      (io.stderr ?? DEFAULT_IO.stderr)('Invalid --sync-interval-ms value. Use a positive number.');
      return 1;
    }

    const stdout = io.stdout ?? DEFAULT_IO.stdout;
    if (hasFlag(rest, '--json')) {
      stdout(JSON.stringify(example, null, 2));
      return 0;
    }

    for (const line of formatMemorySyncDevExample(example)) {
      stdout(line);
    }

    return 0;
  }

  if (command === 'sandbox-diagnostics') {
    const { runSandboxDiagnosticsCommand } = await import('./commands/sandbox-diagnostics.js');
    return runSandboxDiagnosticsCommand(rest, io);
  }

  if (command === 'content-address-stats') {
    const { runContentAddressStatsCommand } = await import('./commands/content-address-stats.js');
    return runContentAddressStatsCommand(rest, io);
  }

  (io.stderr ?? DEFAULT_IO.stderr)(`Unknown command: ${command ?? '(none)'}`);
  (io.stderr ?? DEFAULT_IO.stderr)(
    'Supported commands: compress, compress-memory, memory-sync-dev, sandbox-diagnostics, content-address-stats'
  );
  return 1;
}
