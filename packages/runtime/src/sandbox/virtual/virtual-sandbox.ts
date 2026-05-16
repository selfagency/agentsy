import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const DEFAULT_TIMEOUT_MS = 5_000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, 'sandbox-worker.js');

export function createVirtualSandbox(): VirtualSandbox {
  return {
    mode: 'virtual',

    async execute(input): Promise<SandboxOutput> {
      const start = Date.now();
      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const stdout: string[] = [];
      const stderr: string[] = [];

      return new Promise(resolve => {
        const worker = new Worker(WORKER_PATH, {
          workerData: {
            code: input.code,
            env: input.env ?? {},
            timeout: timeoutMs
          }
        });

        const timeout = setTimeout(() => {
          worker.terminate();
          resolve({
            status: 'timeout',
            stdout: stdout.join('\n'),
            stderr: `${stderr.join('\n')}\nExecution timed out after ${timeoutMs}ms`.trim(),
            durationMs: Date.now() - start
          });
        }, timeoutMs);

        worker.on('message', msg => {
          if (msg.type === 'log') stdout.push(msg.args.map(String).join(' '));
          else if (msg.type === 'error' || msg.type === 'runtime-error' || msg.type === 'warn' || msg.type === 'info') {
            const output = Array.isArray(msg.args) ? msg.args.map(String).join(' ') : String(msg.args ?? '');
            stderr.push(output);

            if (msg.type === 'runtime-error') {
              clearTimeout(timeout);
              worker.terminate();
              resolve({
                status: 'error',
                stdout: stdout.join('\n'),
                stderr: stderr.join('\n'),
                durationMs: Date.now() - start,
                exitCode: 1
              });
            }
          } else if (msg.type === 'result') {
            clearTimeout(timeout);
            worker.terminate();
            resolve({
              status: 'ok',
              stdout: stdout.join('\n'),
              stderr: stderr.join('\n'),
              durationMs: Date.now() - start,
              exitCode: 0
            });
          }
        });

        worker.on('error', err => {
          clearTimeout(timeout);
          worker.terminate();
          resolve({
            status: 'error',
            stdout: stdout.join('\n'),
            stderr: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - start,
            exitCode: 1
          });
        });

        worker.on('exit', code => {
          clearTimeout(timeout);
          if (code !== 0) {
            resolve({
              status: 'error',
              stdout: stdout.join('\n'),
              stderr: `Worker exited with code ${code}`,
              durationMs: Date.now() - start,
              exitCode: code
            });
          }
        });
      });
    }
  };
}

// Remove unused runVirtual function
