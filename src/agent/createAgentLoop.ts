import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import { EventType } from '../ag-ui/types.js';
import { createInterruptEvent } from '../ag-ui/interrupt-handler.js';
import type { AgentLoopHandle, AgentLoopOptions, AgentLoopState, OutputPart, StepResult } from './types.js';

/**
 * Checks if both values are objects with matching keys.
 * @internal
 */
function objectKeysMatch(aKeys: string[], bKeys: string[]): boolean {
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k, i) => k === bKeys[i]);
}

/**
 * Deep equality comparison for tool parameters.
 * Compares objects structurally rather than by reference.
 * @internal
 */
function parametersEqual(a: unknown, b: unknown): boolean {
  // Handle primitives and identity
  if (Object.is(a, b)) return true;

  // Check if both are objects
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  // Compare sorted keys
  const aKeys = Object.keys(a).sort((x, y) => x.localeCompare(y));
  const bKeys = Object.keys(b).sort((x, y) => x.localeCompare(y));

  if (!objectKeysMatch(aKeys, bKeys)) return false;

  // Recursively compare values for each key
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  return aKeys.every(k => parametersEqual(aObj[k], bObj[k]));
}

/**
 * Processes a single step of the agent loop and updates state.
 * @internal
 */
async function processSingleStep(
  state: AgentLoopState,
  options: AgentLoopOptions,
  currentMessages: unknown[],
  abortController: AbortController,
  stopConditions: Array<(state: AgentLoopState) => boolean>,
): Promise<{ parts: OutputPart[]; continueLoop: boolean; nextMessages?: unknown[] }> {
  const { processor, isAborted } = await executeStep(options, currentMessages, abortController);

  if (isAborted) {
    return { parts: [], continueLoop: false };
  }

  const finalOutput = processor.flush();
  const parts = finalOutput.parts;

  state.lastOutput = finalOutput;

  // Build step result
  const stepResult: StepResult = {
    output: finalOutput,
    toolCalls: finalOutput.toolCalls,
    finishReason: finalOutput.finishReason ?? undefined,
    usage: finalOutput.usage ?? undefined,
  };

  state.steps.push(stepResult);
  state.stepIndex = state.steps.length - 1;
  updateConsecutiveIdenticalCalls(state, stepResult);
  state.toolCallCount += stepResult.toolCalls.length;

  if (options.onStep) {
    await options.onStep(stepResult);
  }

  // Check stop conditions
  if (stopConditions.some(condition => condition(state)) || stepResult.toolCalls.length === 0) {
    return { parts, continueLoop: false };
  }

  // Build next messages with conversation trimming
  const toolResultMessages = await options.buildToolResultMessages(stepResult.toolCalls);
  const newMessages = [...currentMessages, { role: 'assistant', content: finalOutput.content }, ...toolResultMessages];

  const nextMessages =
    options.maxConversationMessages && newMessages.length > options.maxConversationMessages
      ? newMessages.slice(newMessages.length - options.maxConversationMessages)
      : newMessages;

  return { parts, continueLoop: true, nextMessages };
}

/**
 * Updates the consecutive identical calls counter for doom-loop detection.
 * Compares the first tool call of the current step with the previous step.
 * @internal
 */
function updateConsecutiveIdenticalCalls(state: AgentLoopState, stepResult: StepResult): void {
  if (state.steps.length >= 2 && stepResult.toolCalls.length > 0) {
    const prevStep = state.steps.at(-2);
    if (prevStep && prevStep.toolCalls.length > 0) {
      const prev = prevStep.toolCalls[0];
      const curr = stepResult.toolCalls[0];
      if (!prev || !curr) return;
      if (prev.name === curr.name && parametersEqual(prev.parameters, curr.parameters)) {
        state.consecutiveIdenticalCalls += 1;
      } else {
        state.consecutiveIdenticalCalls = 0;
      }
    }
  }
}

/**
 * Processes a single step of the agent loop: executes LLM and flushes output.
 * @internal
 */
async function executeStep(
  options: AgentLoopOptions,
  currentMessages: unknown[],
  abortController: AbortController,
): Promise<{ processor: LLMStreamProcessor; isAborted: boolean }> {
  const processor = new LLMStreamProcessor();

  try {
    for await (const chunk of options.execute(currentMessages)) {
      processor.process(chunk);
    }
  } catch (error) {
    processor.flush();
    throw error;
  }

  return {
    processor,
    isAborted: abortController.signal.aborted,
  };
}

export function createAgentLoop(options: AgentLoopOptions): AgentLoopHandle {
  let aborted = false;
  const abortController = new AbortController();

  async function* run(initialMessages: unknown[]): AsyncGenerator<OutputPart> {
    const runId = options.runId || `run_${Math.random().toString(36).slice(2, 11)}`;
    const { threadId, onAgUiEvent, interruptController } = options;

    const state: AgentLoopState = {
      steps: [],
      stepIndex: 0,
      lastOutput: {
        thinking: '',
        content: '',
        toolCalls: [],
        done: false,
        parts: [],
        incomplete: false,
        incompleteness: [],
      },
      toolCallCount: 0,
      consecutiveIdenticalCalls: 0,
    };

    const maxSteps = options.maxSteps ?? 20;
    const stopConditions = Array.isArray(options.stopWhen) ? options.stopWhen : [options.stopWhen];

    let currentMessages = initialMessages;

    // Emit RUN_STARTED
    if (onAgUiEvent) {
      const runStartedBase = {
        type: EventType.RUN_STARTED as const,
        runId,
        timestamp: new Date().toISOString(),
      };
      const runStarted = {
        ...runStartedBase,
        ...(threadId !== undefined && { threadId }),
      };
      try {
        await onAgUiEvent(runStarted as any);
      } catch (error) {
        console.error('Error in onAgUiEvent callback for RUN_STARTED:', error);
        // Continue despite callback error
      }
    }

    try {
      while (!aborted && state.steps.length < maxSteps) {
        // Check for interrupts
        if (interruptController?.isInterrupted()) {
          const interruptEvent = createInterruptEvent(
            runId,
            interruptController.getReason(),
            interruptController.getMessage(),
            threadId,
          );
          if (onAgUiEvent) {
            try {
              await onAgUiEvent(interruptEvent);
            } catch (error) {
              console.error('Error in onAgUiEvent callback for interrupt:', error);
            }
          }
          break;
        }

        // Emit STEP_STARTED
        if (onAgUiEvent) {
          const stepStartedBase = {
            type: EventType.STEP_STARTED as const,
            runId,
            stepIndex: state.steps.length,
            timestamp: new Date().toISOString(),
          };
          const stepStarted = {
            ...stepStartedBase,
            ...(threadId !== undefined && { threadId }),
          };
          try {
            await onAgUiEvent(stepStarted as any);
          } catch (error) {
            console.error('Error in onAgUiEvent callback for STEP_STARTED:', error);
          }
        }

        const result = await processSingleStep(state, options, currentMessages, abortController, stopConditions);

        // Emit STEP_FINISHED (always, regardless of parts)
        if (onAgUiEvent) {
          const stepFinishedBase = {
            type: EventType.STEP_FINISHED as const,
            runId,
            stepIndex: state.stepIndex,
            outputLength: result.parts.length,
            timestamp: new Date().toISOString(),
          };
          const stepFinished = {
            ...stepFinishedBase,
            ...(threadId !== undefined && { threadId }),
          };
          try {
            await onAgUiEvent(stepFinished as any);
          } catch (error) {
            console.error('Error in onAgUiEvent callback for STEP_FINISHED:', error);
          }
        }

        // Yield all parts from this step
        for (const part of result.parts) {
          yield part;
        }

        // Check if we should continue
        if (!result.continueLoop) {
          break;
        }

        // Update for next iteration
        if (result.nextMessages) {
          currentMessages = result.nextMessages;
        }
      }

      // Emit RUN_FINISHED on success
      if (onAgUiEvent) {
        const runFinishedBase = {
          type: EventType.RUN_FINISHED as const,
          runId,
          outcome: { type: 'success' as const },
          timestamp: new Date().toISOString(),
        };
        const runFinished = {
          ...runFinishedBase,
          ...(threadId !== undefined && { threadId }),
        };
        try {
          await onAgUiEvent(runFinished as any);
        } catch (error) {
          console.error('Error in onAgUiEvent callback for RUN_FINISHED:', error);
        }
      }
    } catch (error) {
      // Emit RUN_ERROR on failure
      if (onAgUiEvent) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown agent loop error';
        const runErrorBase = {
          type: EventType.RUN_ERROR as const,
          runId,
          error: { message: errorMessage },
          timestamp: new Date().toISOString(),
        };
        const runError = {
          ...runErrorBase,
          ...(threadId !== undefined && { threadId }),
        };
        try {
          await onAgUiEvent(runError as any);
        } catch (callbackError) {
          console.error('Error in onAgUiEvent callback for RUN_ERROR:', callbackError);
        }
      }
      throw error;
    }
  }

  return {
    run,
    abort: () => {
      aborted = true;
      abortController.abort();
    },
  };
}

export type AgentLoop = ReturnType<typeof createAgentLoop>;
