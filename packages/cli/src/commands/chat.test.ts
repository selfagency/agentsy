import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runChatCommand } from './chat.js';

/**
 * Create a mock stdin PassThrough, write lines into it, and end it.
 */
function makeMockStdin(lines: string[]): PassThrough {
  const stream = new PassThrough();
  // Defer writes to allow the readline to set up listeners
  setImmediate(() => {
    for (const line of lines) {
      stream.write(`${line}\n`);
    }
    stream.end();
  });
  return stream;
}

describe('chat command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits cleanly with /exit command', async () => {
    const mockStdin = makeMockStdin(['/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock', '--model', 'test-model'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.some(c => c.includes('[mock]'))).toBeTruthy();
  });

  it('sends user message to mock provider and receives response', async () => {
    const mockStdin = makeMockStdin(['Hello!', '/exit']);
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const exitCode = await runChatCommand(
      ['--mock', '--model', 'test-model'],
      {
        stderr: () => {
          // no-op
        }
      },
      {
        input: mockStdin,
        mockResponseText: 'Test mock response!',
        mockChunkDelayMs: 1
      }
    );

    expect(exitCode).toBe(0);

    const allOutput = stdoutChunks.join('');
    expect(allOutput).toContain('assistant');
  });

  it('handles /help command', async () => {
    const mockStdin = makeMockStdin(['/help', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.some(c => c.includes('Commands:'))).toBeTruthy();
  });

  it('handles empty line gracefully', async () => {
    const mockStdin = makeMockStdin(['', '/exit']);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: () => {
          // no-op
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
  });

  it('handles /clear command', async () => {
    const mockStdin = makeMockStdin(['/clear', '/exit']);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      { stderr: () => undefined },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('handles /status command', async () => {
    const mockStdin = makeMockStdin(['/status', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.some(c => c.includes('[status]'))).toBeTruthy();
  });

  it('handles unknown slash command', async () => {
    const mockStdin = makeMockStdin(['/unknown', '/exit']);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      { stderr: () => undefined },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
  });

  it('handles /model command with model name', async () => {
    const mockStdin = makeMockStdin(['/model gpt-5', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.some(c => c.includes('[model]'))).toBeTruthy();
  });

  it('handles /model search command', async () => {
    const mockStdin = makeMockStdin(['/model search local coding', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[model] search');
  });

  it('handles /model refine command', async () => {
    const mockStdin = makeMockStdin(['/model refine', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[model] refine');
  });

  it('handles /provider search command', async () => {
    const mockStdin = makeMockStdin(['/provider search', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[provider] discovering local providers');
  });

  it('includes YAML slash commands in help output', async () => {
    const mockStdin = makeMockStdin(['/help', '/exit']);
    const stderrChunks: string[] = [];

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('/model search');
    expect(stderrChunks.join('')).toContain('/provider search');
  });

  it('respects explicit --provider and --model overrides', async () => {
    const mockStdin = makeMockStdin(['/status', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock', '--provider', 'anthropic', '--model', 'claude-sonnet-4'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('claude-sonnet-4');
  });

  it('can be dispatched through runCli', async () => {
    const { runCli } = await import('../index.js');

    const mockStdin = makeMockStdin(['/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runCli(['chat', '--mock', '--model', 'test-model'], {
        stderr: () => {
          // no-op
        }
      });

      expect(exitCode).toBe(0);
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('prints a graceful message for /lb status when running with --mock', async () => {
    // The mock client is not a LoadBalancedClient, so /lb
    // commands should print a friendly "not a gateway client"
    // message instead of throwing.
    const mockStdin = makeMockStdin(['/lb status', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      { stderr: msg => stderrChunks.push(msg) },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    const joined = stderrChunks.join('');
    expect(joined).toContain('[lb]');
    expect(joined).toContain('not a load-balanced gateway client');
  });

  it('rejects /lb strategy with an unknown name', async () => {
    const mockStdin = makeMockStdin(['/lb strategy bogus-strategy', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      { stderr: msg => stderrChunks.push(msg) },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[lb]');
  });

  it('prints the /model current state on bare /model', async () => {
    const mockStdin = makeMockStdin(['/model', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock', '--model', 'gpt-4o'],
      { stderr: msg => stderrChunks.push(msg) },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('current model: gpt-4o');
  });

  it('handles /agent list command', async () => {
    const mockStdin = makeMockStdin(['/agent list', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[agent]');
  });

  it('handles /agent show with an agent id', async () => {
    const mockStdin = makeMockStdin(['/agent show research', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    const joined = stderrChunks.join('');
    expect(joined).toContain('[agent]');
    expect(joined).toContain('research');
  });

  it('handles /agent show with missing id shows usage', async () => {
    const mockStdin = makeMockStdin(['/agent show', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    await expect(exitCode).resolves.toBe(0);
    expect(stderrChunks.join('')).toContain('[agent] usage: /agent show <agentId>');
  });

  it('handles /agent select command', async () => {
    const mockStdin = makeMockStdin(['/agent select code', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    const joined = stderrChunks.join('');
    expect(joined).toContain('[agent] switch intent logged');
  });

  it('handles /agent select with missing id shows usage', async () => {
    const mockStdin = makeMockStdin(['/agent select', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    await expect(exitCode).resolves.toBe(0);
    expect(stderrChunks.join('')).toContain('[agent] usage: /agent select <agentId>');
  });

  it('handles /skills list command', async () => {
    const mockStdin = makeMockStdin(['/skills list', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[skills]');
  });

  it('handles /skills show command', async () => {
    const mockStdin = makeMockStdin(['/skills show nonexistent', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[skills] "nonexistent" not found');
  });

  it('handles bare /agent command shows usage', async () => {
    const mockStdin = makeMockStdin(['/agent', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[agent] usage');
  });

  it('handles bare /skills command shows usage', async () => {
    const mockStdin = makeMockStdin(['/skills', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[skills] usage');
  });

  it('handles --agent flag loads agent and sets system prompt', async () => {
    const mockStdin = makeMockStdin(['/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock', '--agent', 'research'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    const joined = stderrChunks.join('');
    expect(joined).toContain('[agent] loaded');
    expect(joined).toContain('Research Agent');
  });

  it('handles --plan flag shows plan mode enabled', async () => {
    const mockStdin = makeMockStdin(['do something', '/exit']);
    const stderrChunks: string[] = [];
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const exitCode = await runChatCommand(
      ['--mock', '--agent', 'default', '--plan'],
      {
        stderr: (msg: string) => {
          stderrChunks.push(msg);
        }
      },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('[plan] plan mode enabled');
    expect(stdoutChunks.join('')).toContain('tools were not executed');
  });

  it('rejects /model select on a non-gateway client', async () => {
    const mockStdin = makeMockStdin(['/model select gpt-4o', '/exit']);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      ['--mock'],
      { stderr: msg => stderrChunks.push(msg) },
      { input: mockStdin, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    expect(stderrChunks.join('')).toContain('not a load-balanced gateway client');
  });

  it('runs /model select and /lb status against a real LoadBalancedClient', async () => {
    const { createLoadBalancedClient } = await import('@agentsy/gateway');
    const client = createLoadBalancedClient({
      providers: [{ id: 'openai-1', model: 'gpt-4o', name: 'OpenAI', provider: 'openai' }]
    });
    const mockStdin = makeMockStdin([
      '/model select gpt-4o-mini',
      '/lb status',
      '/lb strategy cost-based',
      '/lb reset openai-1',
      '/exit'
    ]);
    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runChatCommand(
      [],
      { stderr: msg => stderrChunks.push(msg) },
      { input: mockStdin, loadBalancedClient: client, mockChunkDelayMs: 1 }
    );

    expect(exitCode).toBe(0);
    const joined = stderrChunks.join('');
    expect(joined).toContain('[model] switched to');
    expect(joined).toContain('[lb] strategy=');
    expect(joined).toContain('[lb] strategy switched to: cost-based');
    expect(joined).toContain('[lb] reset circuit for: openai-1');
  });
});
