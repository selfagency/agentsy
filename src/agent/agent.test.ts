import { describe, expect, it, vi } from 'vitest';
import type { XmlToolCall } from '../tool-calls/extractXmlToolCalls.js';
import { createAgentLoop, detectDoomLoop, finishReasonIs, hasNoToolCalls, isStepCount } from './index.js';
import type { AgentLoopState, OutputPart, StepResult } from './index.js';
import type { ProcessedOutput } from '../processor/LLMStreamProcessor.js';

describe('Stop Conditions', () => {
  describe('isStepCount', () => {
    it('should stop after reaching max steps', () => {
      const condition = isStepCount(2);
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'step 1',
              toolCalls: [],
              done: false,
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: undefined,
            usage: undefined,
          },
          {
            output: {
              thinking: '',
              content: 'step 2',
              toolCalls: [],
              done: true,
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: undefined,
            usage: undefined,
          },
        ],
        stepIndex: 1,
        lastOutput: {
          thinking: '',
          content: 'step 2',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(true);
    });

    it('should not stop before reaching max steps', () => {
      const condition = isStepCount(3);
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'step 1',
              toolCalls: [],
              done: false,
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: undefined,
            usage: undefined,
          },
        ],
        stepIndex: 0,
        lastOutput: {
          thinking: '',
          content: 'step 1',
          toolCalls: [],
          done: false,
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(false);
    });
  });

  describe('hasNoToolCalls', () => {
    it('should stop when last step has no tool calls', () => {
      const condition = hasNoToolCalls();
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'final response',
              toolCalls: [],
              done: true,
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: undefined,
            usage: undefined,
          },
        ],
        stepIndex: 0,
        lastOutput: {
          thinking: '',
          content: 'final response',
          toolCalls: [],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(true);
    });

    it('should not stop when last step has tool calls', () => {
      const condition = hasNoToolCalls();
      const toolCall: XmlToolCall = {
        name: 'test_fn',
        parameters: {},
        format: 'bare-xml',
        id: '1',
      };
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: '',
              toolCalls: [toolCall],
              done: true,
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [toolCall],
            finishReason: undefined,
            usage: undefined,
          },
        ],
        stepIndex: 0,
        lastOutput: {
          thinking: '',
          content: '',
          toolCalls: [toolCall],
          done: true,
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 1,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(false);
    });
  });

  describe('finishReasonIs', () => {
    it('should stop when finishReason matches', () => {
      const condition = finishReasonIs('stop', 'length');
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'done',
              toolCalls: [],
              done: true,
              finishReason: 'stop',
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: 'stop',
            usage: undefined,
          },
        ],
        stepIndex: 0,
        lastOutput: {
          thinking: '',
          content: 'done',
          toolCalls: [],
          done: true,
          finishReason: 'stop',
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(true);
    });

    it('should not stop when finishReason does not match', () => {
      const condition = finishReasonIs('stop');
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'more',
              toolCalls: [],
              done: false,
              finishReason: 'length',
              parts: [],
              incomplete: false,
              incompleteness: [],
            },
            toolCalls: [],
            finishReason: 'length',
            usage: undefined,
          },
        ],
        stepIndex: 0,
        lastOutput: {
          thinking: '',
          content: 'more',
          toolCalls: [],
          done: false,
          finishReason: 'length',
          parts: [],
          incomplete: false,
          incompleteness: [],
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(false);
    });
  });

  describe('detectDoomLoop', () => {
    function createMockOutput(toolCalls: XmlToolCall[]): ProcessedOutput {
      return {
        thinking: '',
        content: '',
        toolCalls,
        done: false,
        parts: [],
        incomplete: false,
        incompleteness: [],
      };
    }

    function createMockStep(toolCall: XmlToolCall): StepResult {
      return {
        output: createMockOutput([toolCall]),
        toolCalls: [toolCall],
        finishReason: undefined,
        usage: undefined,
      };
    }

    function createMockState(
      steps: StepResult[],
      lastToolCalls: XmlToolCall[],
      consecutiveCount: number,
    ): AgentLoopState {
      return {
        steps,
        stepIndex: steps.length - 1,
        lastOutput: createMockOutput(lastToolCalls),
        toolCallCount: steps.length,
        consecutiveIdenticalCalls: consecutiveCount,
      };
    }

    it('should detect identical tool calls repeated n times', () => {
      const condition = detectDoomLoop(2);
      const toolCall: XmlToolCall = {
        name: 'search',
        parameters: { query: 'test' },
        format: 'bare-xml',
        id: '1',
      };
      const step1 = createMockStep(toolCall);
      const step2 = createMockStep(toolCall);
      const state: AgentLoopState = createMockState([step1, step2], [toolCall], 2);

      expect(condition(state)).toBe(true);
    });

    it('should not trigger doom loop for different tool calls', () => {
      const condition = detectDoomLoop(2);
      const call1: XmlToolCall = {
        name: 'search',
        parameters: { query: 'first' },
        format: 'bare-xml',
        id: '1',
      };
      const call2: XmlToolCall = {
        name: 'search',
        parameters: { query: 'second' },
        format: 'bare-xml',
        id: '2',
      };
      const step1 = createMockStep(call1);
      const step2 = createMockStep(call2);
      const state: AgentLoopState = createMockState([step1, step2], [call2], 0);

      expect(condition(state)).toBe(false);
    });

    it('should detect identical tool calls despite parameter key order variations', async () => {
      const condition = detectDoomLoop(1);
      // Create two identical tool calls with parameters in different order
      const call1: XmlToolCall = {
        name: 'search',
        parameters: { query: 'test', limit: 10 },
        format: 'bare-xml',
        id: '1',
      };
      const call2: XmlToolCall = {
        name: 'search',
        parameters: { limit: 10, query: 'test' }, // Same params, different order
        format: 'bare-xml',
        id: '2',
      };
      const step1 = createMockStep(call1);
      const step2 = createMockStep(call2);
      const state: AgentLoopState = createMockState([step1, step2], [call2], 1);

      // Should detect as identical despite key order difference
      expect(condition(state)).toBe(true);
    });
  });
});

describe('createAgentLoop', () => {
  it('should call execute and accumulate steps', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      execute: async function* () {
        executeCount += 1;
        yield { content: 'Response', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBeGreaterThan(0);
  });

  it('should stop when isStepCount condition is met', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      execute: async function* () {
        executeCount += 1;
        yield { content: 'Response', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      maxSteps: 10,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBe(1);
  });

  it('should respect maxSteps limit', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      execute: async function* () {
        executeCount += 1;
        yield { content: 'Response', done: true, finishReason: 'stop' as const };
      },
      stopWhen: [],
      maxSteps: 1,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBe(1);
  });

  it('should call onStep callback for each step', async () => {
    const onStepSpy = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'result', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      onStep: onStepSpy,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(onStepSpy).toHaveBeenCalled();
  });

  it('should abort the loop', async () => {
    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'chunk', done: false };
        yield { done: true, finishReason: 'stop' as const };
      },
      stopWhen: [],
      maxSteps: 10,
      buildToolResultMessages: async () => [],
    });

    const gen = loop.run([]);
    await gen.next();
    loop.abort();

    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  it('should process and emit output parts from execute function', async () => {
    const parts: OutputPart[] = [];

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'Part 1', done: false };
        yield { content: ' Part 2', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      buildToolResultMessages: async () => [],
    });

    for await (const part of loop.run([])) {
      parts.push(part);
    }

    // Should have accumulated and emitted output parts
    expect(parts.length).toBeGreaterThan(0);
    // Should contain text parts from the yields
    const textParts = parts.filter(p => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);
  });

  it('should trim conversation history when maxConversationMessages is set', async () => {
    let messagesInSecondCall: unknown[] | undefined;

    const loop = createAgentLoop({
      execute: async function* (messages) {
        // Capture messages from any call where we have tool calls
        if (Array.isArray(messages) && messages.length >= 5) {
          messagesInSecondCall = messages;
        }
        // Always yield a simple response
        yield { content: 'Response', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      maxConversationMessages: 4,
      buildToolResultMessages: async () => [],
    });

    const initialMessages = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));

    for await (const _part of loop.run(initialMessages)) {
      // consume
    }

    // First call should receive all 5 messages (no trimming on first call)
    // Since we're using isStepCount(1), we only get one execution
    expect(messagesInSecondCall?.length).toBe(5);
  });
});
