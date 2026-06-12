import { describe, expect, it } from 'vitest';
import { runMemoryCommand } from './memory.js';

function makeIo() {
  const lines: string[] = [];
  return {
    stderr: (msg: string) => {
      lines.push(`err: ${msg}`);
    },
    stdout: (msg: string) => {
      lines.push(`out: ${msg}`);
    },
    lines: () => lines
  };
}

describe('memory command', () => {
  it('shows usage when no subcommand given', async () => {
    const io = makeIo();
    const code = await runMemoryCommand([], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Usage');
  });

  it('shows usage for empty search query', async () => {
    const io = makeIo();
    const code = await runMemoryCommand(['search'], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Usage');
  });

  it('accepts search query', async () => {
    const io = makeIo();
    const code = await runMemoryCommand(['search', 'dark mode'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('dark mode');
  });

  it('handles stats subcommand', async () => {
    const io = makeIo();
    const code = await runMemoryCommand(['stats'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('Memory');
  });

  it('handles lint subcommand', async () => {
    const io = makeIo();
    const code = await runMemoryCommand(['lint'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('Memory');
  });

  it('returns error for unknown subcommand', async () => {
    const io = makeIo();
    const code = await runMemoryCommand(['unknown'], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Unknown');
  });
});
