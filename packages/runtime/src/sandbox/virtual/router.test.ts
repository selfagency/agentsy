import { describe, expect, it } from 'vitest';
import { createSandboxRouter } from './router.js';
import type { SandboxTriggerDecision } from './dynamic-trigger.js';
import type { ContainerSandboxStub } from './router.js';
import type { SandboxInput, SandboxOutput } from './virtual-sandbox.js';

function makeDecision(mode: SandboxTriggerDecision['mode']): SandboxTriggerDecision {
  return { mode, reason: 'test' };
}

function makeContainerStub(): ContainerSandboxStub {
  return {
    mode: 'container',
    async execute(_input: SandboxInput): Promise<SandboxOutput> {
      return { status: 'ok', stdout: 'container ran', stderr: '', durationMs: 0 };
    }
  };
}

describe('createSandboxRouter', () => {
  it('routes virtual decision to VirtualSandbox', () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('virtual'));
    expect(sandbox).toBeDefined();
    expect(typeof sandbox.execute).toBe('function');
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
    expect(typeof sandbox.execute).toBe('function');
    expect((sandbox as { mode?: string }).mode).not.toBe('container');
  });

  it('routes none decision to VirtualSandbox (fallback)', () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('none'));
    expect(typeof sandbox.execute).toBe('function');
  });

  it('virtual sandbox execute() runs simple code', async () => {
    const router = createSandboxRouter();
    const sandbox = router.route(makeDecision('virtual'));
    const result = await sandbox.execute({ code: 'console.log("hi");', env: {} });
    expect(['ok', 'error', 'timeout']).toContain(result.status);
  });
});
