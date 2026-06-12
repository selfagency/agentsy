export interface PrecompressionContext {
  focus?: string;
  sessionId: string;
}

export interface PrecompressionMarker {
  id: string;
  reason: string;
  type: 'pin' | 'preserve' | 'rehydrate';
}

export interface PrecompressionPlan {
  context: PrecompressionContext;
  markers: PrecompressionMarker[];
}

export interface PrecompressionEvent {
  contextSize: number;
  sessionId: string;
  type: 'PreCompact';
}

export function createPrecompressionPlan(event: PrecompressionEvent): PrecompressionPlan | null {
  if (event.type !== 'PreCompact') {
    return null;
  }

  const markers: PrecompressionMarker[] = [
    {
      id: `session:${event.sessionId}`,
      reason: 'keep session continuity',
      type: 'rehydrate'
    }
  ];

  return {
    context: {
      sessionId: event.sessionId
    },
    markers
  };
}
