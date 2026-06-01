import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVirtualSandbox } from './virtual-sandbox.js';

// Mutable store — updated by beforeEach, read by Worker constructor mock
let nextWorkerInstance: object;

// We need to mock node:worker_threads to test the Worker lifecycle without actual threads failing in CI
vi.mock('node:worker_threads', () => {
  const MockWorker = function MockWorker() {
    return nextWorkerInstance;
  } as unknown as typeof import('node:worker_threads')['Worker'];
  return {
    Worker: MockWorker
  };
});

function createMockInstance() {
  return {
    on: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn().mockResolvedValue(0),
    unref: vi.fn()
  };
}

describe('VirtualSandbox', () => {
  let mockWorkerInstance: ReturnType<typeof createMockInstance>;

  beforeEach(() => {
    mockWorkerInstance = createMockInstance();
    nextWorkerInstance = mockWorkerInstance;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should execute code and return ok status', async () => {
    const sandbox = createVirtualSandbox();
    const executePromise = sandbox.execute({ code: 'console.log("hi");' });

    // Extract the 'message' listener
    const messageCall = mockWorkerInstance.on.mock.calls.find((c: unknown[]) => c[0] === 'message');
    if (!messageCall) {
      throw new Error('message listener not found');
    }
    const onMessage = messageCall[1] as (msg: unknown) => void;

    // Simulate log
    onMessage({ args: ['hi'], type: 'log' });
    // Simulate result
    onMessage({ type: 'result', value: undefined });

    const result = await executePromise;
    expect(result.status).toBe('ok');
    expect(result.stdout).toBe('hi');
    expect(mockWorkerInstance.terminate).toHaveBeenCalledWith();
  });

  it('should handle timeout', async () => {
    const sandbox = createVirtualSandbox();
    const executePromise = sandbox.execute({
      code: 'while(true);',
      timeoutMs: 100
    });

    // Fast-forward time
    vi.advanceTimersByTime(150);

    const result = await executePromise;
    expect(result.status).toBe('timeout');
    expect(result.stderr).toContain('timed out');
    expect(mockWorkerInstance.terminate).toHaveBeenCalledWith();
  });

  it('should handle worker error', async () => {
    const sandbox = createVirtualSandbox();
    const executePromise = sandbox.execute({
      code: 'throw new Error("boom");'
    });

    const errorCall = mockWorkerInstance.on.mock.calls.find((c: unknown[]) => c[0] === 'error');
    if (!errorCall) {
      throw new Error('error listener not found');
    }
    const onError = errorCall[1] as (err: Error) => void;
    onError(new Error('boom'));

    const result = await executePromise;
    expect(result.status).toBe('error');
    expect(result.stderr).toBe('boom');
  });

  it('should handle non-zero exit code', async () => {
    const sandbox = createVirtualSandbox();
    const executePromise = sandbox.execute({ code: 'process.exit(1);' });

    const exitCall = mockWorkerInstance.on.mock.calls.find((c: unknown[]) => c[0] === 'exit');
    if (!exitCall) {
      throw new Error('exit listener not found');
    }
    const onExit = exitCall[1] as (code: number) => void;
    onExit(1);

    const result = await executePromise;
    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
  });

  it('should handle worker messages for warn, error, info', async () => {
    const sandbox = createVirtualSandbox();
    const executePromise = sandbox.execute({
      code: 'console.warn("w"); console.error("e");'
    });

    const messageCall = mockWorkerInstance.on.mock.calls.find((c: unknown[]) => c[0] === 'message');
    if (!messageCall) {
      throw new Error('message listener not found');
    }
    const onMessage = messageCall[1] as (msg: unknown) => void;
    onMessage({ args: ['w'], type: 'warn' });
    onMessage({ args: ['e'], type: 'error' });
    onMessage({ args: ['i'], type: 'info' });
    onMessage({ type: 'result', value: null });

    const result = await executePromise;
    expect(result.stderr).toContain('w');
    expect(result.stderr).toContain('e');
    expect(result.stderr).toContain('i');
  });
});
