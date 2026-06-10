import type { ToolDefinition } from '../../definitions.js';

export function createReplTool(): ToolDefinition {
  return {
    name: 'repl_execute',
    description: 'Execute arbitrary JavaScript/TypeScript code in a sandboxed REPL environment.',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      requiresApproval: true
    },
    parameters: [
      { name: 'code', type: 'string', required: true, description: 'The code to execute' },
      { name: 'timeout', type: 'number', required: false, description: 'Execution timeout in ms' }
    ],
    handler: input => {
      const code = String(input.code ?? '');
      if (!code) {
        return { ok: false, data: null, error: 'Missing required parameter: code' };
      }
      return { ok: true, data: { result: 'Execution placeholder', code } };
    }
  };
}
