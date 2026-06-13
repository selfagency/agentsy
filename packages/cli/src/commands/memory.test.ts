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
  it('shows usage when no subcommand given', () => {
    const io = makeIo();
    const code = runMemoryCommand([], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Usage');
  });

  it('shows usage for empty search query', () => {
    const io = makeIo();
    const code = runMemoryCommand(['search'], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Usage');
  });

  it('accepts search query', () => {
    const io = makeIo();
    const code = runMemoryCommand(['search', 'dark mode'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('dark mode');
  });

  it('handles stats subcommand', () => {
    const io = makeIo();
    const code = runMemoryCommand(['stats'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('Memory');
  });

  it('handles lint subcommand', () => {
    const io = makeIo();
    const code = runMemoryCommand(['lint'], io);
    expect(code).toBe(0);
    expect(io.lines()[0]).toContain('Memory');
  });

  it('returns error for unknown subcommand', () => {
    const io = makeIo();
    const code = runMemoryCommand(['unknown'], io);
    expect(code).toBe(1);
    expect(io.lines()[0]).toContain('Unknown');
  });
});
