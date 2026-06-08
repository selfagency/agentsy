import { describe, expect, it } from 'vitest';

import { MultiAgentTracer } from './agent-span.js';

describe('MultiAgentTracer', () => {
  describe('createRootSpan', () => {
    it('should create a span with traceId, spanId, and no parentSpanId', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'research');

      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.parentSpanId).toBeUndefined();
      expect(span.agentId).toBe('agent-1');
      expect(span.operationName).toBe('research');
      expect(span.status).toBe('ok');
    });

    it('should set agentRole and agentTier when provided', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'code', {
        agentRole: 'coder',
        agentTier: 'mid'
      });

      expect(span.agentRole).toBe('coder');
      expect(span.agentTier).toBe('mid');
    });

    it('should set metadata when provided', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'task', {
        metadata: { project: 'test', priority: 'high' }
      });

      expect(span.metadata).toEqual({ project: 'test', priority: 'high' });
    });
  });

  describe('createChildSpan', () => {
    it('should inherit traceId from parent and set parentSpanId', () => {
      const tracer = new MultiAgentTracer();
      const parent = tracer.createRootSpan('agent-1', 'research');
      const child = tracer.createChildSpan('agent-2', 'sub-research');

      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.agentId).toBe('agent-2');
    });

    it('should add child to parent delegatedTo and subspans', () => {
      const tracer = new MultiAgentTracer();
      const parent = tracer.createRootSpan('agent-1', 'orchestrate');
      const child = tracer.createChildSpan('agent-2', 'execute');

      expect(parent.delegatedTo).toContain(child.spanId);
      const subspan = parent.subspans.find(s => s.spanId === child.spanId);
      expect(subspan).toBeDefined();
      expect(subspan?.agentId).toBe('agent-2');
    });

    it('should throw when no parent span exists', () => {
      const tracer = new MultiAgentTracer();
      expect(() =>
        tracer.createChildSpan('agent-2', 'task', {
          parentSpanId: 'nonexistent'
        })
      ).toThrow('Parent span nonexistent not found');
    });
  });

  describe('recordToolCall', () => {
    it('should add a toolCall to the span toolCalls array', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'test');

      tracer.recordToolCall(span.spanId, {
        toolName: 'read_file',
        input: { path: '/tmp/test.txt' },
        output: { content: 'hello' },
        status: 'ok',
        duration: 150
      });

      expect(span.toolCalls).toHaveLength(1);
      expect(span.toolCalls[0]?.toolName).toBe('read_file');
      expect(span.toolCalls[0]?.status).toBe('ok');
      expect(span.toolCalls[0]?.duration).toBe(150);
    });

    it('should not throw when spanId is unknown', () => {
      const tracer = new MultiAgentTracer();
      expect(() =>
        tracer.recordToolCall('nonexistent', {
          toolName: 'test',
          input: {},
          output: {},
          status: 'ok',
          duration: 0
        })
      ).not.toThrow();
    });

    it('should record tool calls with cost attribution', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'code');

      tracer.recordToolCall(span.spanId, {
        toolName: 'llm_call',
        input: { prompt: 'hello' },
        output: { text: 'world' },
        status: 'ok',
        duration: 500,
        tokens: {
          inputTokens: 100,
          outputTokens: 50,
          estimatedCost: 0.01,
          modelName: 'gemini-2.0-flash'
        }
      });

      expect(span.toolCalls[0]?.tokens).toBeDefined();
      expect(span.toolCalls[0]?.tokens?.inputTokens).toBe(100);
      expect(span.toolCalls[0]?.tokens?.modelName).toBe('gemini-2.0-flash');
    });
  });

  describe('finishSpan', () => {
    it('should set endTime and status', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'task');

      tracer.finishSpan(span.spanId, 'ok');

      expect(span.endTime).toBeInstanceOf(Date);
      expect(span.status).toBe('ok');
    });

    it('should set error when provided', () => {
      const tracer = new MultiAgentTracer();
      const span = tracer.createRootSpan('agent-1', 'task');

      tracer.finishSpan(span.spanId, 'error', 'Something went wrong');

      expect(span.status).toBe('error');
      expect(span.error).toBe('Something went wrong');
    });

    it('should not throw when spanId is unknown', () => {
      const tracer = new MultiAgentTracer();
      expect(() => tracer.finishSpan('nonexistent', 'ok')).not.toThrow();
    });
  });

  describe('getTrace', () => {
    it('should return root span with nested subspans', () => {
      const tracer = new MultiAgentTracer();
      const root = tracer.createRootSpan('agent-1', 'main-task');
      const child1 = tracer.createChildSpan('agent-2', 'sub-task-1', { parentSpanId: root.spanId });
      const child2 = tracer.createChildSpan('agent-3', 'sub-task-2', { parentSpanId: root.spanId });

      tracer.finishSpan(child1.spanId, 'ok');
      tracer.finishSpan(child2.spanId, 'ok');
      tracer.finishSpan(root.spanId, 'ok');

      const trace = tracer.getTrace(root.traceId);
      expect(trace).toBeDefined();
      expect(trace?.spanId).toBe(root.spanId);
      expect(trace?.subspans).toHaveLength(2);
      expect(trace?.subspans[0]?.agentId).toBe('agent-2');
      expect(trace?.subspans[1]?.agentId).toBe('agent-3');
    });

    it('should return undefined for unknown traceId', () => {
      const tracer = new MultiAgentTracer();
      const result = tracer.getTrace('unknown-trace');
      expect(result).toBeUndefined();
    });
  });
});
