import type { AgentLoopState, StopCondition, FinishReason } from './types.js';

/**
 * Stop after a fixed number of steps.
 */
export function isStepCount(maxSteps: number): StopCondition {
  return (state: AgentLoopState): boolean => state.steps.length >= maxSteps;
}

/**
 * Stop when the most recent step returned no tool calls.
 */
export function hasNoToolCalls(): StopCondition {
  return (state: AgentLoopState): boolean => {
    if (state.steps.length === 0) return false;
    const lastStep = state.steps[state.steps.length - 1];
    if (!lastStep) return false;
    return lastStep.toolCalls.length === 0;
  };
}

/**
 * Stop when finishReason matches one of the provided reasons.
 */
export function finishReasonIs(...reasons: FinishReason[]): StopCondition {
  return (state: AgentLoopState): boolean => {
    if (state.steps.length === 0) return false;
    const lastStep = state.steps[state.steps.length - 1];
    if (!lastStep || lastStep.finishReason === undefined) return false;
    return reasons.includes(lastStep.finishReason);
  };
}

/**
 * Stop when the same tool call (name + serialized args) is made N times in a row.
 * Serializes arguments to JSON for comparison. Defaults to 3 consecutive identical calls.
 */
export function detectDoomLoop(threshold: number = 3): StopCondition {
  return (state: AgentLoopState): boolean => {
    if (state.steps.length < threshold) return false;

    const recentSteps = state.steps.slice(-threshold);
    const firstCall = recentSteps[0]?.toolCalls[0];
    if (!firstCall) return false;

    const firstSerialized = JSON.stringify({
      name: firstCall.name,
      parameters: firstCall.parameters,
    });

    for (const step of recentSteps) {
      if (step.toolCalls.length === 0) return false;
      const call = step.toolCalls[0];
      if (!call) return false;
      const serialized = JSON.stringify({
        name: call.name,
        parameters: call.parameters,
      });
      if (serialized !== firstSerialized) return false;
    }

    return true;
  };
}
