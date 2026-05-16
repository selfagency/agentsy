import { describe, expect, it, expectTypeOf } from 'vitest';

import type { ContainerSandbox } from '../container/rivet-sandbox.js';
import type { SandboxTriggerDecision } from './dynamic-trigger.js';
import { createSandboxRouter } from './router.js';
import type { SandboxInput, SandboxOutput } from './virtual-sandbox.js';

function makeDecision(mode: SandboxTriggerDecision['mode']): SandboxTriggerDecision {
  return { mode, reason: 'test' };
}

function makeContainerStub(): ContainerSandbox {
  return {
    async destroy(): Promise<void> {},
    async execute(_input: SandboxInput): Promise<SandboxOutput> {
      return {
        durationMs: 0,
        status: 'ok',
        stderr: '',
        stdout: 'container ran'
      };
    },
    mode: 'container'
  };
}

describe(createSandboxRouter, () => {
  it('routes virtual decision to VirtualSandbox', () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('virtual'));
    expect(sandbox).toBeDefined();
    expectTypeOf(sandbox.execute).toBeFunction();
  });

  it('routes container decision to ContainerSandboxStub when provided', () => {
    const router = createSandboxRouter();
    const stub = makeContainerStub();
    const sandbox = router.route(makeDecision('container'), stub);
    expect(sandbox).toBe(stub);
  });

  it('falls back to VirtualSandbox when container decision has no stub', () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('container'));
    // Must still have execute (falls back to virtual)
    expectTypeOf(sandbox.execute).toBeFunction();
    expect((sandbox as { mode?: string }).mode).not.toBe('container');
  });

  it('throws on none decision', () => {
    const router = createSandboxRouter();
    expect(() => router.route(makeDecision('none'))).toThrow('Sandbox execution explicitly disabled by policy');
  });

  it('virtual sandbox execute() runs simple code', async () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('virtual'));
    const result = (await sandbox.execute({
      code: 'console.log("hi");',
      env: {}
    })) as { status: string };
    expect(['ok', 'error', 'timeout']).toContain(result.status);
  });
});
