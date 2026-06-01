export interface RuntimeReusableSegment {
  fingerprint: string;
  invalidations: string[];
  reuseClass: 'hot' | 'warm' | 'cold';
}

export interface BuildRuntimeContextInput {
  invalidatedKeys?: string[];
  modelFamily: string;
  reusableSegments: RuntimeReusableSegment[];
  templateVersion: string;
}

export interface RuntimeContextReuse {
  modelFamily: string;
  reusedSegments: string[];
  templateVersion: string;
}

function reusePriority(reuseClass: RuntimeReusableSegment['reuseClass']): number {
  switch (reuseClass) {
    case 'hot': {
      return 0;
    }
    case 'warm': {
      return 1;
    }
    case 'cold': {
      return 2;
    }
    default: {
      return 999;
    }
  }
}

export function buildRuntimeContext(input: BuildRuntimeContextInput): RuntimeContextReuse {
  const invalidated = new Set(input.invalidatedKeys ?? []);
  const reusedSegments = [...input.reusableSegments]
    .filter(segment => segment.reuseClass !== 'cold')
    .filter(segment => segment.invalidations.every(invalidation => !invalidated.has(invalidation)))
    .toSorted((left, right) => reusePriority(left.reuseClass) - reusePriority(right.reuseClass))
    .map(segment => segment.fingerprint);

  return {
    modelFamily: input.modelFamily,
    reusedSegments,
    templateVersion: input.templateVersion
  };
}
