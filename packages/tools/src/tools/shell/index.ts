import { execSync } from 'node:child_process';
import type { ToolDefinition } from '../../definitions.js';

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
    handler: async input => {
      const command = typeof input.command === 'string' ? input.command : '';
      if (!command) {
        return { ok: false, data: null, error: 'Missing required parameter: command' };
      }

      const timeout = typeof input.timeout === 'number' ? input.timeout : 30_000;
      const cwd = typeof input.workdir === 'string' ? input.workdir : undefined;

      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          timeout,
          cwd,
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });
        return { ok: true, data: { stdout: output, stderr: '', exitCode: 0 } };
      } catch (error) {
        if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
          const execError = error as unknown as { stdout: Buffer; stderr: Buffer; status: number | null };
          return {
            ok: true,
            data: {
              stdout: execError.stdout?.toString() ?? '',
              stderr: execError.stderr?.toString() ?? '',
              exitCode: execError.status ?? 1
            }
          };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, data: null, error: `shell_exec error: ${message}` };
      }
    }
  };
}
