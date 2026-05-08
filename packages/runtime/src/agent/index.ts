export { createAgentLoop } from './createAgentLoop.js';
export { detectDoomLoop, finishReasonIs, hasNoToolCalls, isStepCount } from './stopConditions.js';
export type {
  AgentLoopHandle,
  AgentLoopOptions,
  AgentLoopState,
  FinishReason,
  OutputPart,
  StepResult,
  StopCondition,
  StreamChunk,
} from './types.js';

// Hook system types (P0-002)
export {
  createEmptyHookRegistry,
  registerHook,
  executePreProcessHooks,
  executePostProcessHooks,
  getRegisteredEventTypes,
} from './createAgentLoop.js';

export type {
  PreProcessEvent,
  PostProcessEvent,
  PrepareStepResult,
  HookCallback,
  HookDefinition,
  ProcessExecutionContext,
  HookRegistry,
} from './createAgentLoop.js';
