export interface HydrationCandidate {
  id: string;
  priority: number;
  reason: string;
}

export interface HydrationPolicyInput {
  recentEdits?: ReadonlyArray<{ id: string; weight?: number }>;
  retainedAnchors?: ReadonlyArray<{ id: string; importance: number }>;
  sessionId: string;
}

export interface HydrationPolicyResult {
  candidates: HydrationCandidate[];
  sessionId: string;
}

export function createHydrationPolicy(input: HydrationPolicyInput): HydrationPolicyResult {
  const candidates: HydrationCandidate[] = [];

  for (const anchor of input.retainedAnchors ?? []) {
    candidates.push({
      id: anchor.id,
      priority: 1000 + Math.max(1, Math.round(anchor.importance * 100)),
      reason: 'retained anchor'
    });
  }

  for (const edit of input.recentEdits ?? []) {
    candidates.push({
      id: edit.id,
      priority: Math.max(1, Math.round((edit.weight ?? 1) * 50)),
      reason: 'recent edit'
    });
  }

  const unique = new Map<string, HydrationCandidate>();
  for (const candidate of candidates.toSorted((left, right) => right.priority - left.priority)) {
    unique.set(candidate.id, candidate);
  }

  return {
    candidates: [...unique.values()],
    sessionId: input.sessionId
  };
}
