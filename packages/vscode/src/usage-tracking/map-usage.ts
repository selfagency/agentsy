import type { UsageInfo } from "@agentsy/providers/normalizers";

export interface VSCodeUsage {
  promptTokens: number;
  completionTokens: number;
  outputBuffer?: number;
}

/**
 * Maps core usage fields to VS Code-style token usage fields.
 */
export function mapUsageToVSCode(
  usage: UsageInfo | undefined
): VSCodeUsage | undefined {
  if (usage === undefined) {
    return undefined;
  }

  return {
    completionTokens: usage.outputTokens ?? 0,
    promptTokens: usage.inputTokens ?? 0,
  };
}
