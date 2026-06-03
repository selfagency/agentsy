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
});
