import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

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

const DEFAULT_TIMEOUT_MS = 5000;
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const WORKER_PATH = join(__dirname, 'sandbox-worker.js');

export function createVirtualSandbox(): VirtualSandbox {
  return {
    async execute(input): Promise<SandboxOutput> {
      const start = Date.now();
      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const stdout: string[] = [];
      const stderr: string[] = [];
      let resolved = false;

      return await new Promise(resolve => {
        const worker = new Worker(WORKER_PATH, {
          workerData: {
            code: input.code,
            env: input.env ?? {},
            timeout: timeoutMs
          }
        });

        const timeout = setTimeout(() => {
          if (resolved) {
            return;
          }
          resolved = true;
          void void worker.terminate();
          resolve({
            durationMs: Date.now() - start,
            status: 'timeout',
            stderr: `${stderr.join('\n')}\nExecution timed out after ${timeoutMs}ms`.trim(),
            stdout: stdout.join('\n')
          });
        }, timeoutMs);

        worker.on('message', msg => {
          if ((msg as any).type === 'log') {
            stdout.push(msg.args.map(String).join(' '));
          } else if (
            (msg as any).type === 'error' ||
            (msg as any).type === 'runtime-error' ||
            (msg as any).type === 'warn' ||
            (msg as any).type === 'info'
          ) {
            const output = Array.isArray(msg.args) ? msg.args.map(String).join(' ') : String(msg.args ?? '');
            stderr.push(output);

            if ((msg as any).type === 'runtime-error') {
              if (resolved) {
                return;
              }
              resolved = true;
              clearTimeout(timeout);
              void void worker.terminate();
              resolve({
                durationMs: Date.now() - start,
                exitCode: 1,
                status: 'error',
                stderr: stderr.join('\n'),
                stdout: stdout.join('\n')
              });
            }
          } else if ((msg as any).type === 'result') {
            if (resolved) {
              return;
            }
            resolved = true;
            clearTimeout(timeout);
            void void worker.terminate();
            resolve({
              durationMs: Date.now() - start,
              exitCode: 0,
              status: 'ok',
              stderr: stderr.join('\n'),
              stdout: stdout.join('\n')
            });
          }
        });

        worker.on('error', err => {
          if (resolved) {
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          void void worker.terminate();
          resolve({
            durationMs: Date.now() - start,
            exitCode: 1,
            status: 'error',
            stderr: err instanceof Error ? err.message : String(err),
            stdout: stdout.join('\n')
          });
        });

        worker.on('exit', code => {
          if (resolved) {
            return;
          }
          resolved = true;
          clearTimeout(timeout);
          if (code !== 0) {
            resolve({
              durationMs: Date.now() - start,
              exitCode: code,
              status: 'error',
              stderr: `Worker exited with code ${code}`,
              stdout: stdout.join('\n')
            });
          } else {
            resolve({
              durationMs: Date.now() - start,
              exitCode: 0,
              status: 'ok',
              stderr: stderr.join('\n'),
              stdout: stdout.join('\n')
            });
          }
        });
      });
    },

    mode: 'virtual'
  };
}

// Remove unused runVirtual function
