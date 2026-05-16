export interface RuntimeReusableSegment {
  fingerprint: string;
  reuseClass: 'hot' | 'warm' | 'cold';
  invalidations: string[];
}

export interface BuildRuntimeContextInput {
  modelFamily: string;
  templateVersion: string;
  reusableSegments: RuntimeReusableSegment[];
  invalidatedKeys?: string[];
}

export interface RuntimeContextReuse {
  modelFamily: string;
  templateVersion: string;
  reusedSegments: string[];
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
