import type { HookResult, RuntimeHookEvent } from './types.js';

/**
 * Contract for the user-approval gate dependency.
 *
 * The runtime implements this to surface an approval prompt to the user
 * (e.g., via a terminal prompt, VS Code notification, or web UI dialog).
 */
export interface ApprovalGate {
  /**
   * Request user approval for a potentially destructive tool call.
   *
   * @param toolName - The name of the tool being called.
   * @param args - The arguments the tool will receive.
   * @returns `true` if the user approved, `false` if rejected.
   */
  requestApproval(toolName: string, args: unknown): Promise<boolean>;
}

/**
 * Glob patterns that identify destructive tool operations.
 * Matched against the lowercased `toolName`.
 */
const DESTRUCTIVE_PATTERNS = [
  'write',
  'delete',
  'remove',
  'destroy',
  'overwrite',
  'truncate',
  'drop',
  'clear',
  'reset',
  'purge',
  'wipe',
  'nuke',
  'rm',
  'kill',
  'terminate',
  'shutdown',
  'restart',
  'format',
  'replace',
  'rename',
  'move',
  'archive',
  'expunge',
  'erase',
  'unlink',
  'chmod',
  'chown'
] as const;

/**
 * Check whether a tool name matches any destructive pattern.
 *
 * @internal Exported for testing.
 */
export function isDestructiveTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return DESTRUCTIVE_PATTERNS.some(pattern => lower.includes(pattern));
}

/**
 * Create a pre-tool-call approval hook that gates destructive operations.
 *
 * Fires on `PreToolCall` at priority 100. If the tool name matches a
 * destructive pattern, the hook calls the provided `ApprovalGate` to
 * request user confirmation. Execution is blocked until the user responds.
 *
 * @param approvalGate - The approval gate implementation.
 *
 * @example
 * ```ts
 * const hook = createApprovalHook(myApprovalGate);
 * registry.register('PreToolCall', hook.handler, {
 *   id: hook.id,
 *   priority: hook.priority,
 * });
 * ```
 */
export function createApprovalHook(approvalGate: ApprovalGate): {
  handler: (event: RuntimeHookEvent) => Promise<HookResult>;
  id: string;
  priority: number;
} {
  return {
    id: 'approval:destructive-gate',
    priority: 100,
    handler: (event: RuntimeHookEvent): Promise<HookResult> => {
      try {
        // Only gate tool calls
        if (event.type !== 'PreToolCall') {
          return Promise.resolve({ continue: true });
        }

        // Non-destructive tools pass through immediately
        if (!isDestructiveTool(event.toolName)) {
          return Promise.resolve({ continue: true });
        }

        // Request user approval for destructive tools
        return approvalGate
          .requestApproval(event.toolName, event.args)
          .then(approved => {
            if (approved) {
              return { continue: true } satisfies HookResult;
            }
            return {
              continue: false,
              reason: `Operation rejected by user: "${event.toolName}" requires approval`
            } satisfies HookResult;
          })
          .catch(() => {
            // Isolate hook errors — never propagate to the main execution loop
            return { continue: true } satisfies HookResult;
          });
      } catch {
        // Isolate synchronous errors
        return Promise.resolve({ continue: true });
      }
    }
  };
}
