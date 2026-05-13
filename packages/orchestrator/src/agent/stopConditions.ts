import type { AgentLoopState, FinishReason, StopCondition } from './types.js';

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
    const lastStep = state.steps.at(-1);
    if (!lastStep) return false;
    return lastStep.toolCalls.length === 0;
  };
}

/**
 * Stop when the most recent step contains at least one tool call, optionally matching a specific name.
 */
export function hasToolCall(name?: string): StopCondition {
  return (state: AgentLoopState): boolean => {
    const lastStep = state.steps.at(-1);
    if (!lastStep) return false;
    if (name === undefined) return lastStep.toolCalls.length > 0;
    return lastStep.toolCalls.some(toolCall => toolCall.name === name);
  };
}

/**
 * Stop when finishReason matches one of the provided reasons.
 */
export function finishReasonIs(...reasons: FinishReason[]): StopCondition {
  return (state: AgentLoopState): boolean => {
    if (state.steps.length === 0) return false;
    const lastStep = state.steps.at(-1);
    return lastStep?.finishReason !== undefined && reasons.includes(lastStep.finishReason);
  };
}

/**
 * Stop when the last step finished without further tool calls, indicating the loop reached a terminal model response.
 */
export function isLoopFinished(): StopCondition {
  return (state: AgentLoopState): boolean => {
    const lastStep = state.steps.at(-1);
    if (!lastStep) return false;
    return lastStep.toolCalls.length === 0 && lastStep.finishReason !== undefined;
  };
}

/**
 * Stop when the same tool call (name + parameters) is made N times in a row.
 * Uses the agent loop's deep-equality check via consecutiveIdenticalCalls counter.
 * Defaults to 3 consecutive identical calls.
 */
export function detectDoomLoop(threshold: number = 3): StopCondition {
  return (state: AgentLoopState): boolean => {
    // Use the loop's maintained counter which tracks consecutive identical calls
    // via deep-equality comparison (not fragile JSON.stringify)
    return state.consecutiveIdenticalCalls >= threshold;
  };
}
