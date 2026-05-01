import { LLMStreamProcessor } from '../processor/LLMStreamProcessor.js';
import type { AgentLoopHandle, AgentLoopOptions, AgentLoopState, OutputPart, StepResult } from './types.js';

/**
 * Deep equality comparison for tool parameters.
 * Compares objects structurally rather than by reference.
 * @internal
 */
function parametersEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  if (!aKeys.every((k, i) => k === bKeys[i])) return false;
  return aKeys.every(k => parametersEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Creates an agent loop handle for multi-step LLM execution with configurable stop conditions.
 * Automatically accumulates tool calls, builds tool results, and manages conversation state.
 */
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

    while (!aborted && state.steps.length < maxSteps) {
      const { processor, isAborted } = await executeStep(options, currentMessages, abortController);

      if (isAborted || aborted) {
        break;
      }

      const finalOutput = processor.flush();

      // Emit all parts from this step
      for (const part of finalOutput.parts) {
        yield part;
      }

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

      // Update doom-loop counter
      if (state.steps.length >= 2 && stepResult.toolCalls.length > 0) {
        const prevStep = state.steps.at(-2);
        if ((prevStep?.toolCalls.length ?? 0) > 0) {
          const prev = prevStep?.toolCalls[0];
          const curr = stepResult.toolCalls[0];
          if (prev && curr && prev.name === curr.name && parametersEqual(prev.parameters, curr.parameters)) {
            state.consecutiveIdenticalCalls += 1;
          } else {
            state.consecutiveIdenticalCalls = 0;
          }
        }
      }

      state.toolCallCount += stepResult.toolCalls.length;

      if (options.onStep) {
        await options.onStep(stepResult);
      }

      if (stopConditions.some(condition => condition(state)) || stepResult.toolCalls.length === 0) {
        break;
      }

      const toolResultMessages = await options.buildToolResultMessages(stepResult.toolCalls);
      const newMessages = [
        ...currentMessages,
        { role: 'assistant', content: finalOutput.content },
        ...toolResultMessages,
      ];

      currentMessages =
        options.maxConversationMessages && newMessages.length > options.maxConversationMessages
          ? newMessages.slice(newMessages.length - options.maxConversationMessages)
          : newMessages;
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
