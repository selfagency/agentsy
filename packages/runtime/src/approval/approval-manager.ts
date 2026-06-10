/**
 * A pending approval request awaiting user confirmation.
 *
 * @internal
 */
export interface PendingApproval {
  args: unknown;
  resolve: (approved: boolean) => void;
  startedAt: number;
  timeout: number;
  toolName: string;
}

/**
 * Options for the ApprovalManager.
 */
export interface ApprovalManagerOptions {
  /** How long (ms) to wait for user approval before auto-denying. */
  approvalTimeout?: number;
}

/**
 * Default timeout for approval requests (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Concrete approval gate that coordinates tool-approval prompts.
 *
 * The ApprovalManager owns a queue of pending approvals and provides
 * a standard `requestApproval` interface that the runtime's approval
 * hook calls.  External consumers (CLI, UI) call `resolve` / `rejectAll`
 * to drive the queue, keeping the interactive layer decoupled from the
 * policy layer.
 *
 * @example
 * ```ts
 * const manager = new ApprovalManager();
 *
 * // Hook side: block until user decides
 * const ok = await manager.requestApproval('fs_write', { path: '/etc/passwd' });
 *
 * // CLI side: list and resolve
 * for (const p of manager.listPending()) { ... }
 * manager.resolve(pending.toolName, true);
 * ```
 */
export class ApprovalManager {
  readonly #pending: PendingApproval[] = [];
  readonly #options: Required<ApprovalManagerOptions>;

  constructor(options?: ApprovalManagerOptions) {
    this.#options = {
      approvalTimeout: options?.approvalTimeout ?? DEFAULT_TIMEOUT_MS
    };
  }

  /**
   * Request approval for a tool call.
   *
   * Returns a promise that resolves when an external consumer calls
   * {@link resolve} or {@link rejectAll}.  The promise auto-rejects
   * after {@link ApprovalManagerOptions.approvalTimeout} ms.
   */
  requestApproval(toolName: string, args: unknown): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const entry: PendingApproval = {
        args,
        resolve,
        startedAt: Date.now(),
        timeout: this.#options.approvalTimeout,
        toolName
      };
      this.#pending.push(entry);

      // Auto-deny after timeout
      setTimeout(() => {
        const idx = this.#pending.indexOf(entry);
        if (idx !== -1) {
          this.#pending.splice(idx, 1);
          resolve(false);
        }
      }, this.#options.approvalTimeout);
    });
  }

  /**
   * List all pending approval requests.
   */
  listPending(): readonly PendingApproval[] {
    return [...this.#pending];
  }

  /**
   * Resolve a pending approval by tool name (first pending match).
   *
   * Returns `true` if a matching pending request was resolved.
   */
  resolve(toolName: string, approved: boolean): boolean {
    const idx = this.#pending.findIndex(p => p.toolName === toolName);
    if (idx === -1) {
      return false;
    }
    const [entry] = this.#pending.splice(idx, 1);
    if (entry) {
      entry.resolve(approved);
    }
    return true;
  }

  /**
   * Reject all pending approval requests.
   */
  rejectAll(): void {
    while (this.#pending.length > 0) {
      const entry = this.#pending.shift();
      if (entry) {
        entry.resolve(false);
      }
    }
  }

  /**
   * The number of pending approval requests.
   */
  get pendingCount(): number {
    return this.#pending.length;
  }
}
