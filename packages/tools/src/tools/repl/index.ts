import vm from 'node:vm';
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
    handler: async input => {
      const code = typeof input.code === 'string' ? input.code : '';
      if (!code) {
        return { ok: false, data: null, error: 'Missing required parameter: code' };
      }

      const timeout = typeof input.timeout === 'number' ? input.timeout : 10_000;

      try {
        const sandbox: Record<string, unknown> = Object.create(null);
        const context = vm.createContext(sandbox);
        const script = new vm.Script(code);
        const result = await script.runInContext(context, { timeout });
        return { ok: true, data: { result: String(result), code } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, data: { code }, error: `Execution error: ${message}` };
      }
    }
  };
}
