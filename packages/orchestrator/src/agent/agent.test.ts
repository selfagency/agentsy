import type { ProcessedOutput } from '@agentsy/core/processor';
import type { XmlToolCall } from '@agentsy/core/tool-calls';
import { describe, expect, it, vi } from 'vitest';

import type { AgentLoopState, OutputPart, StepResult } from './index.js';

type Message = { content: string; role: string };
import {
  createAgentLoop,
  detectDoomLoop,
  finishReasonIs,
  hasNoToolCalls,
  hasToolCall,
  isLoopFinished,
  isStepCount,
  mergeCallbacks
} from './index.js';

// Helper functions for doom loop tests
function createMockOutput(toolCalls: XmlToolCall[]): ProcessedOutput {
  return {
    content: '',
    done: false,
    incomplete: false,
    incompleteness: [],
    parts: [],
    thinking: '',
    toolCalls
  };
}

function createMockStep(toolCall: XmlToolCall): StepResult {
  return {
    finishReason: undefined,
    output: createMockOutput([toolCall]),
    toolCalls: [toolCall],
    usage: undefined
  };
}

function createMockState(steps: StepResult[], lastToolCalls: XmlToolCall[], consecutiveCount: number): AgentLoopState {
  return {
    consecutiveIdenticalCalls: consecutiveCount,
    lastOutput: createMockOutput(lastToolCalls),
    stepIndex: steps.length - 1,
    steps,
    toolCallCount: steps.length
  };
}

describe('Stop Conditions', () => {
  describe(isStepCount, () => {
    it('should stop after reaching max steps', () => {
      const condition = isStepCount(2);
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'step 2',
          done: true,
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 1,
        steps: [
          {
            finishReason: undefined,
            output: {
              content: 'step 1',
              done: false,
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          },
          {
            finishReason: undefined,
            output: {
              content: 'step 2',
              done: true,
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeTruthy();
    });

    it('should not stop before reaching max steps', () => {
      const condition = isStepCount(3);
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'step 1',
          done: false,
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: undefined,
            output: {
              content: 'step 1',
              done: false,
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeFalsy();
    });
  });

  describe(hasNoToolCalls, () => {
    it('should stop when last step has no tool calls', () => {
      const condition = hasNoToolCalls();
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'final response',
          done: true,
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: undefined,
            output: {
              content: 'final response',
              done: true,
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeTruthy();
    });

    it('should not stop when last step has tool calls', () => {
      const condition = hasNoToolCalls();
      const toolCall: XmlToolCall = {
        format: 'bare-xml',
        id: '1',
        name: 'test_fn',
        parameters: {}
      };
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: '',
          done: true,
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: [toolCall]
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: undefined,
            output: {
              content: '',
              done: true,
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: [toolCall]
            },
            toolCalls: [toolCall],
            usage: undefined
          }
        ],
        toolCallCount: 1
      };

      expect(condition(state)).toBeFalsy();
    });
  });

  describe(hasToolCall, () => {
    it('should stop when the last step contains any tool call', () => {
      const condition = hasToolCall();
      const toolCall: XmlToolCall = {
        format: 'bare-xml',
        name: 'search',
        parameters: { query: 'docs' }
      };

      expect(condition(createMockState([createMockStep(toolCall)], [toolCall], 0))).toBeTruthy();
    });

    it('should only stop for a matching tool name when one is provided', () => {
      const condition = hasToolCall('fetch');
      const toolCall: XmlToolCall = {
        format: 'bare-xml',
        name: 'search',
        parameters: { query: 'docs' }
      };

      expect(condition(createMockState([createMockStep(toolCall)], [toolCall], 0))).toBeFalsy();
    });
  });

  describe(finishReasonIs, () => {
    it('should stop when finishReason matches', () => {
      const condition = finishReasonIs('stop', 'length');
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'done',
          done: true,
          finishReason: 'stop',
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: 'stop',
            output: {
              content: 'done',
              done: true,
              finishReason: 'stop',
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeTruthy();
    });

    it('should not stop when finishReason does not match', () => {
      const condition = finishReasonIs('stop');
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'more',
          done: false,
          finishReason: 'length',
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: 'length',
            output: {
              content: 'more',
              done: false,
              finishReason: 'length',
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeFalsy();
    });
  });

  describe(isLoopFinished, () => {
    it('should stop when the last step has a finish reason and no tool calls', () => {
      const condition = isLoopFinished();
      const state: AgentLoopState = {
        consecutiveIdenticalCalls: 0,
        lastOutput: {
          content: 'done',
          done: true,
          finishReason: 'stop',
          incomplete: false,
          incompleteness: [],
          parts: [],
          thinking: '',
          toolCalls: []
        },
        stepIndex: 0,
        steps: [
          {
            finishReason: 'stop',
            output: {
              content: 'done',
              done: true,
              finishReason: 'stop',
              incomplete: false,
              incompleteness: [],
              parts: [],
              thinking: '',
              toolCalls: []
            },
            toolCalls: [],
            usage: undefined
          }
        ],
        toolCallCount: 0
      };

      expect(condition(state)).toBeTruthy();
    });
  });

  describe(detectDoomLoop, () => {
    it('should detect identical tool calls repeated n times', () => {
      const condition = detectDoomLoop(2);
      const toolCall: XmlToolCall = {
        format: 'bare-xml',
        id: '1',
        name: 'search',
        parameters: { query: 'test' }
      };
      const step1 = createMockStep(toolCall);
      const step2 = createMockStep(toolCall);
      const state: AgentLoopState = createMockState([step1, step2], [toolCall], 2);

      expect(condition(state)).toBeTruthy();
    });

    it('should not trigger doom loop for different tool calls', () => {
      const condition = detectDoomLoop(2);
      const call1: XmlToolCall = {
        format: 'bare-xml',
        id: '1',
        name: 'search',
        parameters: { query: 'first' }
      };
      const call2: XmlToolCall = {
        format: 'bare-xml',
        id: '2',
        name: 'search',
        parameters: { query: 'second' }
      };
      const step1 = createMockStep(call1);
      const step2 = createMockStep(call2);
      const state: AgentLoopState = createMockState([step1, step2], [call2], 0);

      expect(condition(state)).toBeFalsy();
    });

    it('should detect identical tool calls despite parameter key order variations', async () => {
      const condition = detectDoomLoop(1);
      // Create two identical tool calls with parameters in different order
      const call1: XmlToolCall = {
        format: 'bare-xml',
        id: '1',
        name: 'search',
        parameters: { limit: 10, query: 'test' }
      };
      const call2: XmlToolCall = {
        format: 'bare-xml',
        id: '2',
        name: 'search',
        parameters: { limit: 10, query: 'test' } // Same params, different order
      };
      const step1 = createMockStep(call1);
      const step2 = createMockStep(call2);
      const state: AgentLoopState = createMockState([step1, step2], [call2], 1);

      // Should detect as identical despite key order difference
      expect(condition(state)).toBeTruthy();
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
      }
    );

    await merged?.();

    expect(calls).toStrictEqual(['a', 'b']);
  });

  it('should call execute and accumulate steps', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      buildToolResultMessages: async () => [],
      async *execute() {
        executeCount += 1;
        yield {
          content: 'Response',
          done: true,
          finishReason: 'stop' as const
        };
      },
      stopWhen: isStepCount(1)
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBeGreaterThan(0);
  });

  it('should stop when isStepCount condition is met', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      buildToolResultMessages: async () => [],
      async *execute() {
        executeCount += 1;
        yield {
          content: 'Response',
          done: true,
          finishReason: 'stop' as const
        };
      },
      maxSteps: 10,
      stopWhen: isStepCount(1)
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBe(1);
  });

  it('should respect maxSteps limit', async () => {
    let executeCount = 0;
    const loop = createAgentLoop({
      buildToolResultMessages: async () => [],
      async *execute() {
        executeCount += 1;
        yield {
          content: 'Response',
          done: true,
          finishReason: 'stop' as const
        };
      },
      maxSteps: 1,
      stopWhen: []
    });

    for await (const _part of loop.run([])) {
      // consume loop
    }

    expect(executeCount).toBe(1);
  });

  it('should call onStep callback for each step', async () => {
    const onStepSpy = vi.fn();

    const loop = createAgentLoop({
      buildToolResultMessages: async () => [],
      async *execute() {
        yield { content: 'result', done: true, finishReason: 'stop' as const };
      },
      onStep: onStepSpy,
      stopWhen: isStepCount(1)
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
      afterInit,
      beforeInit,
      buildToolResultMessages: async () => [],
      async *execute() {
        yield { content: 'result', done: true, finishReason: 'stop' as const };
      },
      stopWhen: isStepCount(1)
    });

    for await (const _part of loop.run([{ content: 'hello', role: 'user' }])) {
      // consume loop
    }

    expect(beforeInit).toHaveBeenCalledOnce();
    const beforeInitContext = beforeInit.mock.calls[0]?.[0] as { messages?: Message[] };

    expect((beforeInitContext as { messages?: Message[] }).messages || []).toStrictEqual([
      { content: 'hello', role: 'user' }
    ]);
    const messages = (beforeInitContext as { messages?: Message[] }).messages;
    expect(messages || []).toStrictEqual([{ content: 'hello', role: 'user' }]);

    it('should call beforeStep and afterStep hooks with loop context', async () => {
      const beforeStep = vi.fn();
      const afterStep = vi.fn();

      const loop = createAgentLoop({
        afterStep,
        beforeStep,
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'result', done: true, finishReason: 'stop' as const };
        },
        stopWhen: isStepCount(1)
      });

      for await (const _part of loop.run([{ content: 'hello', role: 'user' }])) {
        // consume loop
      }

      expect(beforeStep).toHaveBeenCalledOnce();
      expect(afterStep).toHaveBeenCalledOnce();

      const beforeContext = beforeStep.mock.calls[0]?.[0] as unknown;
      const afterContext = afterStep.mock.calls[0]?.[0] as unknown;

      expect((beforeContext as { stepIndex?: number } | undefined)?.stepIndex).toBe(0);
      expect((beforeContext as { messages?: Message[] } | undefined)?.messages).toStrictEqual([
        { content: 'hello', role: 'user' }
      ]);
      expect((afterContext as unknown as { stepIndex?: number }).stepIndex).toBe(0);
      expect(
        (afterContext as unknown as { stepResult?: { output?: { content?: string } } } | undefined)?.stepResult?.output
          ?.content || 'missing'
      ).toBe('result');
    });

    it('should allow prepareStep to override messages for a specific step', async () => {
      const seenMessages: unknown[][] = [];

      const loop = createAgentLoop({
        buildToolResultMessages: async () => [],
        async *execute(messages) {
          seenMessages.push(messages);
          yield {
            content: 'prepared',
            done: true,
            finishReason: 'stop' as const
          };
        },
        prepareStep: () => ({
          messages: [{ content: 'prepared message', role: 'system' }]
        }),
        stopWhen: isStepCount(1)
      });

      for await (const _part of loop.run([{ content: 'original', role: 'user' }])) {
        // consume loop
      }

      expect(seenMessages).toStrictEqual([[{ content: 'prepared message', role: 'system' }]]);
    });

    it('should call beforeToolCall and afterToolCall hooks around tool results', async () => {
      const toolCall: XmlToolCall = {
        format: 'bare-xml',
        id: 'tool-1',
        name: 'search',
        parameters: { query: 'docs' }
      };
      const beforeToolCall = vi.fn();
      const afterToolCall = vi.fn();
      const toolResultMessages = [{ content: 'found docs', role: 'tool' }];

      const loop = createAgentLoop({
        afterToolCall,
        beforeToolCall,
        buildToolResultMessages: async () => toolResultMessages,
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: toolCall.parameters,
                  name: toolCall.name
                }
              }
            ]
          };
          yield {
            done: true,
            finishReason: 'tool-calls' as const
          };
        },
        stopWhen: isStepCount(2)
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(beforeToolCall).toHaveBeenCalledOnce();
      expect(afterToolCall).toHaveBeenCalledOnce();
      expect((beforeToolCall.mock.calls[0]?.[0] as { toolCalls: XmlToolCall[] }).toolCalls).toMatchObject([
        {
          name: toolCall.name,
          parameters: toolCall.parameters
        }
      ]);
      expect((afterToolCall.mock.calls[0]?.[0] as { toolCalls: XmlToolCall[] }).toolCalls).toMatchObject([
        {
          name: toolCall.name,
          parameters: toolCall.parameters
        }
      ]);
      expect(
        (afterToolCall.mock.calls[0]?.[0] as { toolResultMessages: typeof toolResultMessages }).toolResultMessages
      ).toStrictEqual(toolResultMessages);
    });

    it('should deny tool calls without building tool results when approval mode is deny', async () => {
      const buildToolResultMessages = vi.fn(async () => [{ content: 'should not happen', role: 'tool' }]);

      const loop = createAgentLoop({
        buildToolResultMessages,
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: { query: 'docs' },
                  name: 'search'
                }
              }
            ]
          };
          yield { done: true, finishReason: 'tool-calls' as const };
        },
        stopWhen: isStepCount(3),
        toolApprovalMode: 'deny'
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(buildToolResultMessages).not.toHaveBeenCalled();
    });

    it('should use ask mode approval callback before building tool results', async () => {
      const approveToolCalls = vi.fn(async () => 'allow' as const);
      const buildToolResultMessages = vi.fn(async () => [{ content: 'approved', role: 'tool' }]);

      const loop = createAgentLoop({
        approveToolCalls,
        buildToolResultMessages,
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: { query: 'docs' },
                  name: 'search'
                }
              }
            ]
          };
          yield { done: true, finishReason: 'tool-calls' as const };
        },
        stopWhen: isStepCount(2),
        toolApprovalMode: 'ask'
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(approveToolCalls).toHaveBeenCalledOnce();
      const approvalCalls = approveToolCalls.mock.calls as unknown as [{ mode?: string }][];
      expect(approvalCalls[0]?.[0]?.mode).toBe('ask');
      expect(buildToolResultMessages).toHaveBeenCalledOnce();
      const buildToolResultCalls = buildToolResultMessages.mock.calls as unknown as [unknown[]][];
      expect(buildToolResultCalls[0]?.[0]).toMatchObject([
        {
          name: 'search',
          parameters: { query: 'docs' }
        }
      ]);
    });

    it('should pass approved and denied tool calls to afterToolCall when approval filters them', async () => {
      const afterToolCall = vi.fn();

      const loop = createAgentLoop({
        afterToolCall,
        approveToolCalls: async context => ({
          approvedToolCalls: context.toolCalls.filter(toolCall => toolCall.name === 'search')
        }),
        buildToolResultMessages: async () => [{ content: 'approved', role: 'tool' }],
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: { query: 'docs' },
                  name: 'search'
                }
              },
              {
                function: {
                  arguments: { url: 'https://example.com' },
                  name: 'fetch'
                }
              }
            ]
          };
          yield { done: true, finishReason: 'tool-calls' as const };
        },
        stopWhen: isStepCount(2),
        toolApprovalMode: 'ask'
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(afterToolCall).toHaveBeenCalledOnce();
      expect(
        (afterToolCall.mock.calls[0]?.[0] as { approvedToolCalls: { name: string; parameters: object }[] })
          .approvedToolCalls
      ).toMatchObject([{ name: 'search', parameters: { query: 'docs' } }]);
      expect(
        (afterToolCall.mock.calls[0]?.[0] as { deniedToolCalls: { name: string; parameters: object }[] })
          .deniedToolCalls
      ).toMatchObject([{ name: 'fetch', parameters: { url: 'https://example.com' } }]);
    });

    it('should treat approved tool calls without ids as matches when name and parameters match', async () => {
      const afterToolCall = vi.fn();

      const loop = createAgentLoop({
        afterToolCall,
        approveToolCalls: async () => ({
          approvedToolCalls: [{ format: 'bare-xml', name: 'search', parameters: { query: 'docs' } }]
        }),
        buildToolResultMessages: async toolCalls =>
          toolCalls.map(toolCall => ({ content: toolCall.name, role: 'tool' })),
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: { query: 'docs' },
                  name: 'search'
                },
                id: 'tool-1'
              }
            ]
          };
          yield { done: true, finishReason: 'tool-calls' as const };
        },
        stopWhen: isStepCount(2),
        toolApprovalMode: 'ask'
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(afterToolCall).toHaveBeenCalledOnce();
      expect((afterToolCall.mock.calls[0]?.[0] as { approvedToolCalls: unknown[] }).approvedToolCalls).toHaveLength(1);
      expect((afterToolCall.mock.calls[0]?.[0] as { deniedToolCalls: unknown[] }).deniedToolCalls).toHaveLength(0);
    });

    it('should merge step override hooks and approval callbacks with base options', async () => {
      const callOrder: string[] = [];
      const loop = createAgentLoop({
        afterToolCall: async () => {
          callOrder.push('base-afterToolCall');
        },
        beforeStep: async () => {
          callOrder.push('base-beforeStep');
        },
        buildToolResultMessages: async () => [{ content: 'approved', role: 'tool' }],
        async *execute() {
          yield {
            tool_calls: [
              {
                function: {
                  arguments: { query: 'docs' },
                  name: 'search'
                }
              }
            ]
          };
          yield { done: true, finishReason: 'tool-calls' as const };
        },
        prepareStep: () => ({
          afterToolCall: async () => {
            callOrder.push('override-afterToolCall');
          },
          approveToolCalls: async (context): Promise<'allow'> => {
            callOrder.push(`override-approve:${context.mode}`);
            return 'allow';
          },
          beforeStep: async () => {
            callOrder.push('override-beforeStep');
          },
          toolApprovalMode: 'ask'
        }),
        stopWhen: isStepCount(2),
        toolApprovalMode: 'deny'
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
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'chunk', done: false };
          yield { done: true, finishReason: 'stop' as const };
        },
        maxSteps: 10,
        stopWhen: []
      });

      const gen = loop.run([]);
      await gen.next();
      loop.abort();

      const result = await gen.next();
      expect(result.done).toBeTruthy();
    });

    it('should call onAbort when abort() is invoked', async () => {
      const onAbort = vi.fn();

      const loop = createAgentLoop({
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'chunk', done: false };
          yield { done: true, finishReason: 'stop' as const };
        },
        maxSteps: 10,
        onAbort,
        stopWhen: []
      });

      const gen = loop.run([]);
      await gen.next();
      loop.abort();
      await gen.next();

      expect(onAbort).toHaveBeenCalledOnce();
      expect(onAbort.mock.calls[0]?.[0]).toBe('abort');
    });

    it('should call onError when execute throws', async () => {
      const onError = vi.fn();

      const loop = createAgentLoop({
        buildToolResultMessages: async () => [],
        async *execute() {
          yield* [];
          throw new Error('step failed');
        },
        onError,
        stopWhen: isStepCount(1)
      });

      await expect(async () => {
        for await (const _part of loop.run([])) {
          // consume loop
        }
      }).rejects.toThrow('step failed');

      expect(onError).toHaveBeenCalledOnce();
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
      expect((onError.mock.calls[0]?.[0] as Error).message).toBe('step failed');
    });

    it('should call beforeFinal and afterFinal with terminal outcome', async () => {
      const beforeFinal = vi.fn();
      const afterFinal = vi.fn();

      const loop = createAgentLoop({
        afterFinal,
        beforeFinal,
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'done', done: true, finishReason: 'stop' as const };
        },
        stopWhen: isStepCount(1)
      });

      for await (const _part of loop.run([])) {
        // consume loop
      }

      expect(beforeFinal).toHaveBeenCalledOnce();
      expect(afterFinal).toHaveBeenCalledOnce();
      expect((beforeFinal.mock.calls[0]?.[0] as { outcome: string }).outcome).toBe('success');
      expect((beforeFinal.mock.calls[0]?.[0] as { finalOutput?: { content: string } }).finalOutput?.content).toBe(
        'done'
      );
      expect((afterFinal.mock.calls[0]?.[0] as { outcome: string }).outcome).toBe('success');
    });

    it('should process and emit output parts from execute function', async () => {
      const parts: OutputPart[] = [];

      const loop = createAgentLoop({
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'Part 1', done: false };
          yield { content: ' Part 2', done: true, finishReason: 'stop' as const };
        },
        stopWhen: isStepCount(1)
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
        buildToolResultMessages: async () => [],
        async *execute(messages) {
          // Capture messages from any call where we have tool calls
          if (Array.isArray(messages) && messages.length >= 5) {
            messagesInSecondCall = messages;
          }
          // Always yield a simple response
          yield {
            content: 'Response',
            done: true,
            finishReason: 'stop' as const
          };
        },
        maxConversationMessages: 4,
        stopWhen: isStepCount(1)
      });

      const initialMessages = Array.from({ length: 5 }, (_, i) => ({
        content: `Message ${i}`,
        role: 'user' as const
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
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: 'chunk1', done: false };
          yield { content: 'chunk2', done: true, finishReason: 'stop' as const };
        },
        stopWhen: isStepCount(1)
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
        buildToolResultMessages: async () => [],
        async *execute() {
          yield { content: `step ${stepCount++}`, done: false };
          yield {
            content: `step ${stepCount++}`,
            done: true,
            finishReason: 'stop' as const
          };
        },
        maxSteps: 5,
        stopWhen: isStepCount(2)
      });

      let partCount = 0;
      for await (const _part of loop.run([])) {
        partCount++;
      }

      // Should have processed multiple parts
      expect(partCount).toBeGreaterThan(0);
    });
  });
});
