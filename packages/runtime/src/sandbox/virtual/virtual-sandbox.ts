export type SandboxExecutionStatus = 'ok' | 'error' | 'timeout' | 'blocked';

export interface SandboxInput {
  readonly code: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export interface SandboxOutput {
  readonly status: SandboxExecutionStatus;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly exitCode?: number;
}

export interface VirtualSandbox {
  readonly mode: 'virtual';
  execute(input: SandboxInput): Promise<SandboxOutput>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export function createVirtualSandbox(): VirtualSandbox {
  return {
    mode: 'virtual',

    async execute(input): Promise<SandboxOutput> {
      const start = Date.now();
      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const timeoutResult: SandboxOutput = {
        status: 'timeout',
        stdout: '',
        stderr: `Execution timed out after ${timeoutMs}ms`,
        durationMs: timeoutMs
      };

      try {
        const result = await Promise.race([
          runVirtual(input, start),
          new Promise<SandboxOutput>(resolve => setTimeout(() => resolve(timeoutResult), timeoutMs))
        ]);
        return result;
      } catch (err) {
        return {
          status: 'error',
          stdout: '',
          stderr: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start
        };
      }
    }
  };
}

async function runVirtual(input: SandboxInput, start: number): Promise<SandboxOutput> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const safeConsole = {
    log: (...args: unknown[]) => stdout.push(args.map(String).join(' ')),
    error: (...args: unknown[]) => stderr.push(args.map(String).join(' ')),
    warn: (...args: unknown[]) => stderr.push(args.map(String).join(' '))
  };

  const safeEnv = Object.freeze({ ...(input.env ?? {}) });

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', 'env', `"use strict";\n${input.code}`);
    fn(safeConsole, safeEnv);
    return {
      status: 'ok',
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      durationMs: Date.now() - start,
      exitCode: 0
    };
  } catch (err) {
    return {
      status: 'error',
      stdout: stdout.join('\n'),
      stderr: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      exitCode: 1
    };
  }
}
