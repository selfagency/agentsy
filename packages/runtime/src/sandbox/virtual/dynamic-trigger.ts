export type SandboxTriggerMode = "virtual" | "container" | "none";

export interface SandboxTriggerContext {
  /** Explicit override from user or operator. */
  readonly forceMode?: SandboxTriggerMode;
  /** Whether a container runtime was detected. */
  readonly containerAvailable?: boolean;
  /** Whether the operation is read-only. */
  readonly readOnly?: boolean;
  /** Trust level of the input being executed. */
  readonly trustLevel?: "trusted" | "untrusted" | "unknown";
}

export interface SandboxTriggerDecision {
  readonly mode: SandboxTriggerMode;
  readonly reason: string;
}

export function decideSandboxTrigger(
  ctx: SandboxTriggerContext
): SandboxTriggerDecision {
  if (ctx.forceMode !== undefined) {
    return { mode: ctx.forceMode, reason: `forced: ${ctx.forceMode}` };
  }

  if (ctx.readOnly === true) {
    return {
      mode: "none",
      reason: "read-only operations do not require a sandbox",
    };
  }

  if (ctx.trustLevel === "untrusted") {
    if (ctx.containerAvailable === true) {
      return {
        mode: "container",
        reason: "untrusted input correctly isolated in container",
      };
    }
    // Block unless container is available for untrusted input
    return {
      mode: "none",
      reason:
        "REFUSED: Untrusted input requires a container sandbox but none is available",
    };
  }

  return { mode: "virtual", reason: "default: virtual-first sandbox" };
}
