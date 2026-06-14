import { execSync } from 'node:child_process';
import type { ToolDefinition, ToolResult } from '../../definitions.js';

export function createShellTool(): ToolDefinition {
  return {
    name: 'shell_exec',
    description: 'Execute a shell command. Deny-by-default for destructive or open-world operations.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
      requiresApproval: true
    },
    parameters: [
      { name: 'command', type: 'string', required: true, description: 'Shell command to execute' },
      { name: 'timeout', type: 'number', required: false, description: 'Timeout in ms' },
      { name: 'workdir', type: 'string', required: false, description: 'Working directory' }
    ],
    handler: handleShellExec
  };
}

function handleShellExec(input: Record<string, unknown>): Promise<ToolResult> {
  const command = typeof input.command === 'string' ? input.command : '';
  if (!command) {
    return Promise.resolve({ ok: false, data: null, error: 'Missing required parameter: command' });
  }

  const timeout = typeof input.timeout === 'number' ? input.timeout : 30_000;
  const cwd = typeof input.workdir === 'string' ? input.workdir : undefined;

  try {
    const output = execSync(command, { encoding: 'utf-8', timeout, cwd, maxBuffer: 10 * 1024 * 1024 });
    return Promise.resolve({ ok: true, data: { stdout: output, stderr: '', exitCode: 0 } });
  } catch (error) {
    return Promise.resolve(parseShellError(error));
  }
}

function parseShellError(error: unknown): ToolResult {
  if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
    const execErr = error as unknown as { stdout: Buffer; stderr: Buffer; status: number | null };
    return {
      ok: true,
      data: {
        stdout: execErr.stdout?.toString() ?? '',
        stderr: execErr.stderr?.toString() ?? '',
        exitCode: execErr.status ?? 1
      }
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, data: null, error: `shell_exec error: ${message}` };
}
