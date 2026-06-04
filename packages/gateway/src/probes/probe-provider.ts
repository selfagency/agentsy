import type { ParsedUsage, ProviderProfile, UsageProbe } from '@agentsy/providers/profiles';

import { type ProbeContext, runProbe } from './run-probe.js';

/**
 * Run every probe declared on a profile, returning the merged
 * `ParsedUsage` from the first successful probe. Probes are tried in
 * declared order so a fast local probe can short-circuit a slow
 * HTTP probe. Returns `null` when every probe fails.
 */
export async function probeProvider(profile: ProviderProfile, ctx: ProbeContext): Promise<ParsedUsage | null> {
  let merged: ParsedUsage | null = null;
  for (const probe of profile.usageProbes) {
    const result = await runProbe(probe, ctx);
    if (result === null) {
      continue;
    }
    merged = mergedSnapshot(merged, result);
  }
  return merged;
}

function mergedSnapshot(prior: ParsedUsage | null, next: ParsedUsage): ParsedUsage {
  if (prior === null) {
    return next;
  }
  const merged: ParsedUsage = { ...prior };
  for (const [key, value] of Object.entries(next) as [keyof ParsedUsage, number][]) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

export function probesAreEmpty(probes: readonly UsageProbe[]): boolean {
  return probes.length === 0;
}
