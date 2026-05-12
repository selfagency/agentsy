import { LLMStreamProcessor } from '@agentsy/core/processor';
import { createInterruptEvent, EventType, type AgUiEvent } from '@agentsy/runtime/ag-ui';
import type {
  AgentLoopContext,
  AgentLoopFinalContext,
  AgentLoopHandle,
  AgentLoopOptions,
  AgentLoopState,
  AgentLoopStepContext,
  AgentLoopToolContext,
  OutputPart,
  ProcessedOutput,
  StepResult,
  ToolApprovalDecision,
  ToolApprovalMode,
  ToolApprovalResult,
} from './types.js';

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

function toolCallsEqual(
  a: { name: string; parameters: unknown; id?: string },
  b: { name: string; parameters: unknown; id?: string },
) {
  return a.name === b.name && a.id === b.id && parametersEqual(a.parameters, b.parameters);
}

function mapApprovalDecision(
  toolCalls: AgentLoopToolContext['toolCalls'],
  decision: ToolApprovalDecision,
): { approvedToolCalls: AgentLoopToolContext['toolCalls']; deniedToolCalls: AgentLoopToolContext['toolCalls'] } {
  return decision === 'allow'
    ? { approvedToolCalls: [...toolCalls], deniedToolCalls: [] }
    : { approvedToolCalls: [], deniedToolCalls: [...toolCalls] };
}

function deriveDeniedToolCalls(
  toolCalls: AgentLoopToolContext['toolCalls'],
  approvedToolCalls: AgentLoopToolContext['toolCalls'],
): AgentLoopToolContext['toolCalls'] {
  return toolCalls.filter(toolCall => !approvedToolCalls.some(candidate => toolCallsEqual(candidate, toolCall)));
}

function normalizeApprovalResult(
  toolCalls: AgentLoopToolContext['toolCalls'],
  result: ToolApprovalResult,
  fallbackDecision: ToolApprovalDecision,
): { approvedToolCalls: AgentLoopToolContext['toolCalls']; deniedToolCalls: AgentLoopToolContext['toolCalls'] } {
  if (result.approvedToolCalls) {
    return {
      approvedToolCalls: [...result.approvedToolCalls],
      deniedToolCalls: result.deniedToolCalls
        ? [...result.deniedToolCalls]
        : deriveDeniedToolCalls(toolCalls, result.approvedToolCalls),
    };
  }

  if (result.deniedToolCalls && result.decision !== 'allow') {
    return {
      approvedToolCalls: deriveDeniedToolCalls(toolCalls, result.deniedToolCalls),
      deniedToolCalls: [...result.deniedToolCalls],
    };
  }

  return mapApprovalDecision(toolCalls, result.decision ?? fallbackDecision);
}

async function resolveToolApproval(
  options: AgentLoopOptions,
  toolContext: AgentLoopToolContext,
): Promise<{
  approvedToolCalls: AgentLoopToolContext['toolCalls'];
  deniedToolCalls: AgentLoopToolContext['toolCalls'];
}> {
  const mode: ToolApprovalMode = options.toolApprovalMode ?? 'allow';

  if (mode === 'allow') {
    return mapApprovalDecision(toolContext.toolCalls, 'allow');
  }

  if (mode === 'deny') {
    return mapApprovalDecision(toolContext.toolCalls, 'deny');
  }

  if (!options.approveToolCalls) {
    return mode === 'ask'
      ? mapApprovalDecision(toolContext.toolCalls, 'deny')
      : mapApprovalDecision(toolContext.toolCalls, 'allow');
  }

  const result = await options.approveToolCalls({
    ...toolContext,
    mode,
  });

  if (typeof result === 'boolean') {
    return mapApprovalDecision(toolContext.toolCalls, result ? 'allow' : 'deny');
  }

  if (result === 'allow' || result === 'deny') {
    return mapApprovalDecision(toolContext.toolCalls, result);
  }

  return normalizeApprovalResult(toolContext.toolCalls, result, mode === 'ask' ? 'deny' : 'allow');
}

/**
 * Safely emit an AG-UI event with error handling.
 * @internal
 */
async function safeEmitEvent(
  event: AgUiEvent,
  callbackName: string,
  onAgUiEvent?: (event: AgUiEvent) => void | Promise<void>,
): Promise<void> {
  if (!onAgUiEvent) return;
  try {
    await Promise.resolve(onAgUiEvent(event));
  } catch (error) {
    console.error(`Error in onAgUiEvent callback for ${callbackName}:`, error);
  }
}

/**
 * Add optional threadId to an event object.
 * @internal
 */
function withThreadId(event: AgUiEvent, threadId?: string): AgUiEvent {
  if (threadId === undefined) return event;
  return { ...event, threadId } as AgUiEvent;
}

/**
 * Processes a single step of the agent loop and updates state.
 * @internal
 */
async function processSingleStep(
  state: AgentLoopState,
  options: AgentLoopOptions,
  context: AgentLoopContext,
  currentMessages: unknown[],
  abortController: AbortController,
  stopConditions: Array<(state: AgentLoopState) => boolean>,
): Promise<{ parts: OutputPart[]; continueLoop: boolean; nextMessages?: unknown[] }> {
  await options.beforeStep?.(context);

  const { processor, parts: streamedParts, isAborted } = await executeStep(options, currentMessages, abortController);

  if (isAborted) {
    return { parts: [], continueLoop: false };
  }

  const flushedOutput = processor.flush();
  const accumulatedMessage = processor.accumulatedMessage;
  const finalOutput: ProcessedOutput = {
    ...flushedOutput,
    thinking: accumulatedMessage.thinking,
    content: accumulatedMessage.content,
    toolCalls: accumulatedMessage.toolCalls,
    parts: [...streamedParts, ...flushedOutput.parts],
    ...(accumulatedMessage.usage === undefined ? {} : { usage: accumulatedMessage.usage }),
  };
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

  const stepContext: AgentLoopStepContext = {
    ...context,
    stepIndex: state.stepIndex,
    state,
    stepResult,
  };

  await options.afterStep?.(stepContext);

  // Check stop conditions
  if (stopConditions.some(condition => condition(state)) || stepResult.toolCalls.length === 0) {
    return { parts, continueLoop: false };
  }

  // Build next messages with conversation trimming
  const toolContext: AgentLoopToolContext = {
    ...stepContext,
    toolCalls: stepResult.toolCalls,
    toolApprovalMode: options.toolApprovalMode ?? 'allow',
  };

  await options.beforeToolCall?.(toolContext);
  const { approvedToolCalls, deniedToolCalls } = await resolveToolApproval(options, toolContext);

  if (approvedToolCalls.length === 0) {
    await options.afterToolCall?.({
      ...toolContext,
      approvedToolCalls,
      deniedToolCalls,
      toolResultMessages: [],
    });
    return { parts, continueLoop: false };
  }

  const toolResultMessages = await options.buildToolResultMessages(approvedToolCalls);
  await options.afterToolCall?.({
    ...toolContext,
    toolCalls: approvedToolCalls,
    approvedToolCalls,
    deniedToolCalls,
    toolResultMessages,
  });
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
): Promise<{ processor: LLMStreamProcessor; parts: OutputPart[]; isAborted: boolean }> {
  const processor = new LLMStreamProcessor();
  const parts: OutputPart[] = [];

  try {
    for await (const chunk of options.execute(currentMessages)) {
      const output = processor.process(chunk);
      parts.push(...output.parts);
    }
  } catch (error) {
    processor.flush();
    throw error;
  }

  return {
    processor,
    parts,
    isAborted: abortController.signal.aborted,
  };
}

export function createAgentLoop(options: AgentLoopOptions): AgentLoopHandle {
  let aborted = false;
  const abortController = new AbortController();

  function createContext(
    runId: string,
    threadId: string | undefined,
    stepIndex: number,
    messages: unknown[],
    state: AgentLoopState,
  ): AgentLoopContext {
    return {
      runId,
      stepIndex,
      messages,
      state,
      signal: abortController.signal,
      ...(threadId !== undefined ? { threadId } : {}),
    };
  }

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
    const initialContext = createContext(runId, threadId, state.steps.length, currentMessages, state);

    await options.beforeInit?.(initialContext);

    // Emit RUN_STARTED
    await safeEmitEvent(
      withThreadId(
        {
          type: EventType.RUN_STARTED as const,
          runId,
          timestamp: new Date().toISOString(),
        },
        threadId,
      ),
      'RUN_STARTED',
      onAgUiEvent,
    );

    await options.afterInit?.(initialContext);

    let abortReason: 'success' | 'interrupt' | 'error' | 'abort' = 'success';

    try {
      while (!aborted && state.steps.length < maxSteps) {
        const loopContext = createContext(runId, threadId, state.steps.length, currentMessages, state);

        // Check for interrupts
        if (interruptController?.isInterrupted()) {
          abortReason = 'interrupt';
          await options.onAbort?.('interrupt', loopContext);
          const interruptEvent = createInterruptEvent(
            runId,
            interruptController.getReason(),
            interruptController.getMessage(),
            threadId,
          );
          await safeEmitEvent(interruptEvent, 'interrupt', onAgUiEvent);
          break;
        }

        // Emit STEP_STARTED
        await safeEmitEvent(
          withThreadId(
            {
              type: EventType.STEP_STARTED as const,
              runId,
              stepIndex: state.steps.length,
              timestamp: new Date().toISOString(),
            },
            threadId,
          ),
          'STEP_STARTED',
          onAgUiEvent,
        );

        const result = await processSingleStep(
          state,
          options,
          loopContext,
          currentMessages,
          abortController,
          stopConditions,
        );

        // Emit STEP_FINISHED (always, regardless of parts)
        await safeEmitEvent(
          withThreadId(
            {
              type: EventType.STEP_FINISHED as const,
              runId,
              stepIndex: state.stepIndex,
              outputLength: result.parts.length,
              timestamp: new Date().toISOString(),
            },
            threadId,
          ),
          'STEP_FINISHED',
          onAgUiEvent,
        );

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

      if (aborted && abortReason === 'success') {
        abortReason = 'abort';
        await options.onAbort?.('abort', createContext(runId, threadId, state.steps.length, currentMessages, state));
      }

      const finalContext: AgentLoopFinalContext = {
        ...createContext(runId, threadId, state.steps.length, currentMessages, state),
        outcome: abortReason,
        finalOutput: state.lastOutput,
      };

      await options.beforeFinal?.(finalContext);

      const finishedOutcomeType = abortReason === 'abort' ? 'interrupt' : abortReason;

      // Emit RUN_FINISHED with appropriate outcome
      await safeEmitEvent(
        withThreadId(
          {
            type: EventType.RUN_FINISHED as const,
            runId,
            outcome: { type: finishedOutcomeType },
            timestamp: new Date().toISOString(),
          } as const,
          threadId,
        ),
        'RUN_FINISHED',
        onAgUiEvent,
      );

      await options.afterFinal?.(finalContext);
    } catch (error) {
      // Emit RUN_ERROR on failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown agent loop error';
      await options.onError?.(
        error instanceof Error ? error : new Error(errorMessage),
        createContext(runId, threadId, state.steps.length, currentMessages, state),
      );
      await safeEmitEvent(
        withThreadId(
          {
            type: EventType.RUN_ERROR as const,
            runId,
            error: { message: errorMessage },
            timestamp: new Date().toISOString(),
          },
          threadId,
        ),
        'RUN_ERROR',
        onAgUiEvent,
      );

      const finalContext: AgentLoopFinalContext = {
        ...createContext(runId, threadId, state.steps.length, currentMessages, state),
        outcome: 'error',
        finalOutput: state.lastOutput,
      };

      await options.beforeFinal?.(finalContext);
      await options.afterFinal?.(finalContext);
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
