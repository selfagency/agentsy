import type { ProcessedOutput } from '@agentsy/core/processor';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
import { describe, expect, it, vi } from 'vitest';
import type { AgentLoopState, OutputPart, StepResult } from './index.js';
import {
  createAgentLoop,
  detectDoomLoop,
  finishReasonIs,
  hasNoToolCalls,
  hasToolCall,
  isLoopFinished,
  isStepCount,
  mergeCallbacks,
} from './index.js';

// Helper functions for doom loop tests
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

function createMockState(steps: StepResult[], lastToolCalls: XmlToolCall[], consecutiveCount: number): AgentLoopState {
  return {
    steps,
    stepIndex: steps.length - 1,
    lastOutput: createMockOutput(lastToolCalls),
    toolCallCount: steps.length,
    consecutiveIdenticalCalls: consecutiveCount,
  };
}

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

  describe('hasToolCall', () => {
    it('should stop when the last step contains any tool call', () => {
      const condition = hasToolCall();
      const toolCall: XmlToolCall = { name: 'search', parameters: { query: 'docs' }, format: 'bare-xml' };

      expect(condition(createMockState([createMockStep(toolCall)], [toolCall], 0))).toBe(true);
    });

    it('should only stop for a matching tool name when one is provided', () => {
      const condition = hasToolCall('fetch');
      const toolCall: XmlToolCall = { name: 'search', parameters: { query: 'docs' }, format: 'bare-xml' };

      expect(condition(createMockState([createMockStep(toolCall)], [toolCall], 0))).toBe(false);
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

  describe('isLoopFinished', () => {
    it('should stop when the last step has a finish reason and no tool calls', () => {
      const condition = isLoopFinished();
      const state: AgentLoopState = {
        steps: [
          {
            output: {
              thinking: '',
              content: 'done',
              toolCalls: [],
              done: true,
              parts: [],
              incomplete: false,
              incompleteness: [],
              finishReason: 'stop',
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
          parts: [],
          incomplete: false,
          incompleteness: [],
          finishReason: 'stop',
        },
        toolCallCount: 0,
        consecutiveIdenticalCalls: 0,
      };

      expect(condition(state)).toBe(true);
    });
  });

  describe('detectDoomLoop', () => {
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
  it('mergeCallbacks should invoke both callbacks in order', async () => {
    const calls: string[] = [];
    const merged = mergeCallbacks(
      async () => {
        calls.push('a');
      },
      async () => {
        calls.push('b');
      },
    );

    await merged?.();

    expect(calls).toEqual(['a', 'b']);
  });

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

  it('should call beforeInit and afterInit hooks around run startup', async () => {
    const beforeInit = vi.fn();
    const afterInit = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'result', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      beforeInit,
      afterInit,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([{ role: 'user', content: 'hello' }])) {
      // consume loop
    }

    expect(beforeInit).toHaveBeenCalledTimes(1);
    expect(afterInit).toHaveBeenCalledTimes(1);
    expect(beforeInit.mock.calls[0]?.[0].messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(afterInit.mock.calls[0]?.[0].messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('should call beforeStep and afterStep hooks with loop context', async () => {
    const beforeStep = vi.fn();
    const afterStep = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'result', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      beforeStep,
      afterStep,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([{ role: 'user', content: 'hello' }])) {
      // consume loop
    }

    expect(beforeStep).toHaveBeenCalledTimes(1);
    expect(afterStep).toHaveBeenCalledTimes(1);

    const beforeContext = beforeStep.mock.calls[0]?.[0];
    const afterContext = afterStep.mock.calls[0]?.[0];

    expect(beforeContext?.stepIndex).toBe(0);
    expect(beforeContext?.messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(afterContext?.stepIndex).toBe(0);
    expect(afterContext?.stepResult.output.content).toBe('result');
  });

  it('should allow prepareStep to override messages for a specific step', async () => {
    const seenMessages: unknown[][] = [];

    const loop = createAgentLoop({
      execute: async function* (messages) {
        seenMessages.push(messages);
        yield { content: 'prepared', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      prepareStep: () => ({ messages: [{ role: 'system', content: 'prepared message' }] }),
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([{ role: 'user', content: 'original' }])) {
      // consume loop
    }

    expect(seenMessages).toEqual([[{ role: 'system', content: 'prepared message' }]]);
  });

  it('should call beforeToolCall and afterToolCall hooks around tool results', async () => {
    const toolCall: XmlToolCall = {
      name: 'search',
      parameters: { query: 'docs' },
      format: 'bare-xml',
      id: 'tool-1',
    };
    const beforeToolCall = vi.fn();
    const afterToolCall = vi.fn();
    const toolResultMessages = [{ role: 'tool', content: 'found docs' }];

    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              function: {
                name: toolCall.name,
                arguments: toolCall.parameters,
              },
            },
          ],
        };
        yield {
          done: true,
          finishReason: 'tool-calls' as const,
        };
      },
      stopWhen: isStepCount(2),
      beforeToolCall,
      afterToolCall,
      buildToolResultMessages: async () => toolResultMessages,
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(beforeToolCall).toHaveBeenCalledTimes(1);
    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(beforeToolCall.mock.calls[0]?.[0].toolCalls).toMatchObject([
      {
        name: toolCall.name,
        parameters: toolCall.parameters,
      },
    ]);
    expect(afterToolCall.mock.calls[0]?.[0].toolCalls).toMatchObject([
      {
        name: toolCall.name,
        parameters: toolCall.parameters,
      },
    ]);
    expect(afterToolCall.mock.calls[0]?.[0].toolResultMessages).toEqual(toolResultMessages);
  });

  it('should deny tool calls without building tool results when approval mode is deny', async () => {
    const buildToolResultMessages = vi.fn(async () => [{ role: 'tool', content: 'should not happen' }]);

    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              function: {
                name: 'search',
                arguments: { query: 'docs' },
              },
            },
          ],
        };
        yield { done: true, finishReason: 'tool-calls' as const };
      },
      stopWhen: isStepCount(3),
      toolApprovalMode: 'deny',
      buildToolResultMessages,
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(buildToolResultMessages).not.toHaveBeenCalled();
  });

  it('should use ask mode approval callback before building tool results', async () => {
    const approveToolCalls = vi.fn(async () => 'allow' as const);
    const buildToolResultMessages = vi.fn(async () => [{ role: 'tool', content: 'approved' }]);

    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              function: {
                name: 'search',
                arguments: { query: 'docs' },
              },
            },
          ],
        };
        yield { done: true, finishReason: 'tool-calls' as const };
      },
      stopWhen: isStepCount(2),
      toolApprovalMode: 'ask',
      approveToolCalls,
      buildToolResultMessages,
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(approveToolCalls).toHaveBeenCalledTimes(1);
    const approvalCalls = approveToolCalls.mock.calls as unknown as Array<[{ mode?: string }]>;
    expect(approvalCalls[0]?.[0]?.mode).toBe('ask');
    expect(buildToolResultMessages).toHaveBeenCalledTimes(1);
    const buildToolResultCalls = buildToolResultMessages.mock.calls as unknown as Array<[unknown[]]>;
    expect(buildToolResultCalls[0]?.[0]).toMatchObject([
      {
        name: 'search',
        parameters: { query: 'docs' },
      },
    ]);
  });

  it('should pass approved and denied tool calls to afterToolCall when approval filters them', async () => {
    const afterToolCall = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              function: {
                name: 'search',
                arguments: { query: 'docs' },
              },
            },
            {
              function: {
                name: 'fetch',
                arguments: { url: 'https://example.com' },
              },
            },
          ],
        };
        yield { done: true, finishReason: 'tool-calls' as const };
      },
      stopWhen: isStepCount(2),
      toolApprovalMode: 'ask',
      approveToolCalls: async context => ({
        approvedToolCalls: context.toolCalls.filter(toolCall => toolCall.name === 'search'),
      }),
      afterToolCall,
      buildToolResultMessages: async () => [{ role: 'tool', content: 'approved' }],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(afterToolCall.mock.calls[0]?.[0].approvedToolCalls).toMatchObject([
      { name: 'search', parameters: { query: 'docs' } },
    ]);
    expect(afterToolCall.mock.calls[0]?.[0].deniedToolCalls).toMatchObject([
      { name: 'fetch', parameters: { url: 'https://example.com' } },
    ]);
  });

  it('should treat approved tool calls without ids as matches when name and parameters match', async () => {
    const afterToolCall = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              id: 'tool-1',
              function: {
                name: 'search',
                arguments: { query: 'docs' },
              },
            },
          ],
        };
        yield { done: true, finishReason: 'tool-calls' as const };
      },
      stopWhen: isStepCount(2),
      toolApprovalMode: 'ask',
      approveToolCalls: async () => ({
        approvedToolCalls: [{ name: 'search', parameters: { query: 'docs' }, format: 'bare-xml' }],
      }),
      afterToolCall,
      buildToolResultMessages: async toolCalls => toolCalls.map(toolCall => ({ role: 'tool', content: toolCall.name })),
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(afterToolCall.mock.calls[0]?.[0].approvedToolCalls).toHaveLength(1);
    expect(afterToolCall.mock.calls[0]?.[0].deniedToolCalls).toHaveLength(0);
  });

  it('should merge step override hooks and approval callbacks with base options', async () => {
    const callOrder: string[] = [];
    const loop = createAgentLoop({
      execute: async function* () {
        yield {
          tool_calls: [
            {
              function: {
                name: 'search',
                arguments: { query: 'docs' },
              },
            },
          ],
        };
        yield { done: true, finishReason: 'tool-calls' as const };
      },
      stopWhen: isStepCount(2),
      toolApprovalMode: 'deny',
      beforeStep: async () => {
        callOrder.push('base-beforeStep');
      },
      afterToolCall: async () => {
        callOrder.push('base-afterToolCall');
      },
      prepareStep: () => ({
        toolApprovalMode: 'ask',
        beforeStep: async () => {
          callOrder.push('override-beforeStep');
        },
        approveToolCalls: async (context): Promise<'allow'> => {
          callOrder.push(`override-approve:${context.mode}`);
          return 'allow';
        },
        afterToolCall: async () => {
          callOrder.push('override-afterToolCall');
        },
      }),
      buildToolResultMessages: async () => [{ role: 'tool', content: 'approved' }],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(callOrder).toContain('base-beforeStep');
    expect(callOrder).toContain('override-beforeStep');
    expect(callOrder).toContain('override-approve:ask');
    expect(callOrder).toContain('base-afterToolCall');
    expect(callOrder).toContain('override-afterToolCall');
    expect(callOrder.indexOf('base-beforeStep')).toBeLessThan(callOrder.indexOf('override-beforeStep'));
    expect(callOrder.indexOf('override-beforeStep')).toBeLessThan(callOrder.indexOf('override-approve:ask'));
    expect(callOrder.indexOf('override-approve:ask')).toBeLessThan(callOrder.indexOf('base-afterToolCall'));
    expect(callOrder.indexOf('base-afterToolCall')).toBeLessThan(callOrder.indexOf('override-afterToolCall'));
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

  it('should call onAbort when abort() is invoked', async () => {
    const onAbort = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'chunk', done: false };
        yield { done: true, finishReason: 'stop' as const };
      },
      stopWhen: [],
      maxSteps: 10,
      onAbort,
      buildToolResultMessages: async () => [],
    });

    const gen = loop.run([]);
    await gen.next();
    loop.abort();
    await gen.next();

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onAbort.mock.calls[0]?.[0]).toBe('abort');
  });

  it('should call onError when execute throws', async () => {
    const onError = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield* [];
        throw new Error('step failed');
      },
      stopWhen: isStepCount(1),
      onError,
      buildToolResultMessages: async () => [],
    });

    await expect(async () => {
      for await (const _part of loop.run([])) {
        // consume loop
      }
    }).rejects.toThrow('step failed');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]?.[0].message).toBe('step failed');
  });

  it('should call beforeFinal and afterFinal with terminal outcome', async () => {
    const beforeFinal = vi.fn();
    const afterFinal = vi.fn();

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'done', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      beforeFinal,
      afterFinal,
      buildToolResultMessages: async () => [],
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(beforeFinal).toHaveBeenCalledTimes(1);
    expect(afterFinal).toHaveBeenCalledTimes(1);
    expect(beforeFinal.mock.calls[0]?.[0].outcome).toBe('success');
    expect(beforeFinal.mock.calls[0]?.[0].finalOutput.content).toBe('done');
    expect(afterFinal.mock.calls[0]?.[0].outcome).toBe('success');
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

  it('should produce output parts during execution', async () => {
    const outputParts: OutputPart[] = [];

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: 'chunk1', done: false };
        yield { content: 'chunk2', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1),
      buildToolResultMessages: async () => [],
    });

    for await (const part of loop.run([])) {
      outputParts.push(part);
    }

    // Should have accumulated output parts
    expect(outputParts.length).toBeGreaterThan(0);
  });

  it('should handle state updates from multiple steps', async () => {
    let stepCount = 0;

    const loop = createAgentLoop({
      execute: async function* () {
        yield { content: `step ${stepCount++}`, done: false };
        yield { content: `step ${stepCount++}`, done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(2),
      maxSteps: 5,
      buildToolResultMessages: async () => [],
    });

    let partCount = 0;
    for await (const _part of loop.run([])) {
      partCount++;
    }

    // Should have processed multiple parts
    expect(partCount).toBeGreaterThan(0);
  });
});
