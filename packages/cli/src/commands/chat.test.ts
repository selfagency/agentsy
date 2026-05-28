import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runChatCommand } from './chat.js';

/**
 * Create a mock stdin PassThrough, write lines into it, and end it.
 * More deterministic than Readable.from(syncGenerator) across Node versions.
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
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(
        ['--mock', '--model', 'test-model'],
        {
          stderr: (msg: string) => {
            stderrChunks.push(msg);
          }
        },
        { mockChunkDelayMs: 1 }
      );

      expect(exitCode).toBe(0);
      expect(stderrChunks.some(c => c.includes('[mock]'))).toBeTruthy();
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('sends user message to mock provider and receives response', async () => {
    const mockStdin = makeMockStdin(['Hello!', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    try {
      const exitCode = await runChatCommand(
        ['--mock', '--model', 'test-model'],
        {
          stderr: () => {
            // no-op
          }
        },
        {
          mockResponseText: 'Test mock response!',
          mockChunkDelayMs: 1
        }
      );

      expect(exitCode).toBe(0);

      const allOutput = stdoutChunks.join('');
      expect(allOutput).toContain('assistant');
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles /help command', async () => {
    const mockStdin = makeMockStdin(['/help', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(
        ['--mock'],
        {
          stderr: (msg: string) => {
            stderrChunks.push(msg);
          }
        },
        { mockChunkDelayMs: 1 }
      );

      expect(exitCode).toBe(0);
      expect(stderrChunks.some(c => c.includes('Commands:'))).toBeTruthy();
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles empty line gracefully', async () => {
    const mockStdin = makeMockStdin(['', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(
        ['--mock'],
        {
          stderr: () => {
            // no-op
          }
        },
        { mockChunkDelayMs: 1 }
      );

      expect(exitCode).toBe(0);
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles /clear command', async () => {
    const mockStdin = makeMockStdin(['/clear', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(['--mock'], { stderr: () => undefined }, { mockChunkDelayMs: 1 });

      expect(exitCode).toBe(0);
      expect(stdoutSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles /status command', async () => {
    const mockStdin = makeMockStdin(['/status', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(
        ['--mock'],
        {
          stderr: (msg: string) => {
            stderrChunks.push(msg);
          }
        },
        { mockChunkDelayMs: 1 }
      );

      expect(exitCode).toBe(0);
      expect(stderrChunks.some(c => c.includes('[status]'))).toBeTruthy();
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles unknown slash command', async () => {
    const mockStdin = makeMockStdin(['/unknown', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(['--mock'], { stderr: () => undefined }, { mockChunkDelayMs: 1 });

      expect(exitCode).toBe(0);
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
  });

  it('handles /model command with model name', async () => {
    const mockStdin = makeMockStdin(['/model gpt-5', '/exit']);
    const origStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      enumerable: true,
      get: () => mockStdin
    });

    const stderrChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const exitCode = await runChatCommand(
        ['--mock'],
        {
          stderr: (msg: string) => {
            stderrChunks.push(msg);
          }
        },
        { mockChunkDelayMs: 1 }
      );

      expect(exitCode).toBe(0);
      expect(stderrChunks.some(c => c.includes('[model]'))).toBeTruthy();
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        enumerable: true,
        get: () => origStdin
      });
    }
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
