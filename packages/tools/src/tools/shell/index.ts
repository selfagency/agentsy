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
    handler: input => {
      const command = String(input.command ?? '');
      if (!command) {
        return { ok: false, data: null, error: 'Missing required parameter: command' };
      }
      return { ok: true, data: { stdout: `[shell_exec placeholder] ${command}`, stderr: '', exitCode: 0 } };
    }
  };
}
