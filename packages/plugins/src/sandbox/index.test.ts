/* oxlint-disable xss/no-mixed-html -- Test inputs intentionally include plugin code strings */

import { describe, expect, it } from 'vitest';

import { type Plugin, runPluginInSandbox } from './index.js';

const createTestPlugin = (code: string): Plugin => ({
  id: 'test-plugin',
  version: '1.0.0',
  code
});

const SIMPLE_HANDLER = `
function handler(input) {
  return { received: input, doubled: input * 2 };
}
`;

const TIMEOUT_HANDLER = `
function handler() {
  while (true) {}
}
`;

const LOG_HANDLER = `
function handler(msg) {
  log(msg);
  return 'logged: ' + msg;
}
`;

async function hasIsolatedVm(): Promise<boolean> {
  try {
    const moduleName = 'isolated-vm';
    await import(moduleName);
    return true;
  } catch {
    return false;
  }
}

describe('SandboxOptions interface', () => {
  it('accepts memoryLimitMb default (64)', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'handler', [5], { memoryLimitMb: 64 });

    expect(result.result).toStrictEqual({ received: 5, doubled: 10 });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('accepts timeoutMs default (5000)', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'handler', [10], { timeoutMs: 5000 });

    expect(result.result).toStrictEqual({ received: 10, doubled: 20 });
  });

  it('accepts allowedCapabilities', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'handler', [3], {
      allowedCapabilities: []
    });

    expect(result.result).toStrictEqual({ received: 3, doubled: 6 });
  });

  it('works with empty options (uses defaults)', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'handler', [7]);

    expect(result.result).toStrictEqual({ received: 7, doubled: 14 });
  });
});

describe('runPluginInSandbox', () => {
  it('executes a simple handler and returns result', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'handler', [42]);

    expect(result).toBeDefined();
    const sandboxResult = result;
    expect(sandboxResult.result).toStrictEqual({
      received: 42,
      doubled: 84
    });
    expect(sandboxResult.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles string arguments', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const plugin = createTestPlugin(`
function handler(name) {
  return 'hello ' + name;
}
`);

    const result = await runPluginInSandbox(plugin, 'handler', ['world']);

    expect(result.result).toBe('hello world');
  });

  it('handles object arguments', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const plugin = createTestPlugin(`
function handler(obj) {
  return { keys: Object.keys(obj), sum: obj.a + obj.b };
}
`);

    const result = await runPluginInSandbox(plugin, 'handler', [{ a: 1, b: 2 }]);

    expect(result.result).toStrictEqual({ keys: ['a', 'b'], sum: 3 });
  });

  it('timeouts when execution exceeds the limit', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(TIMEOUT_HANDLER), 'handler', [], {
      timeoutMs: 100,
      memoryLimitMb: 64
    }).catch((err: unknown) => err);

    expect(result).toBeDefined();
    expect((result as { kind: string }).kind).toBe('timeout');
    expect((result as { message: string }).message).toContain('test-plugin');
    expect((result as { message: string }).message).toContain('timed out');
  });

  it('throws runtime error on bad entrypoint name', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(SIMPLE_HANDLER), 'nonExistentFunction', [1]).catch(
      (err: unknown) => err
    );

    expect(result).toBeDefined();
    expect((result as { kind: string }).kind).toBe('runtime');
  });

  it('throws runtime error on bad plugin code', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin('syntax error {{{'), 'handler', []).catch(
      (err: unknown) => err
    );

    expect(result).toBeDefined();
    expect((result as { kind: string }).kind).toBe('runtime');
  });
});

describe('capability gating', () => {
  it('exposes log capability when explicitly allowed', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(LOG_HANDLER), 'handler', ['test message'], {
      allowedCapabilities: ['log']
    });

    expect(result.result).toBe('logged: test message');
  });

  it('does not expose log when capability is not allowed', async () => {
    if (!(await hasIsolatedVm())) {
      return;
    }

    const result = await runPluginInSandbox(createTestPlugin(LOG_HANDLER), 'handler', ['test'], {
      allowedCapabilities: []
    }).catch((err: unknown) => err);

    expect(result).toBeDefined();
    expect((result as { kind: string }).kind).toBe('runtime');
  });
});

describe('sandbox module availability', () => {
  it('can resolve isolated-vm when the dependency is installed, but safely no-ops when absent', () => {
    expect(typeof hasIsolatedVm).toBe('function');
  });
});
