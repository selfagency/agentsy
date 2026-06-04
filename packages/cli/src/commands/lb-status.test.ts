import { describe, expect, it } from 'vitest';

import { runLbStatusCommand } from './lb-status.js';

function captureIo(): {
  stderr: string[];
  stdout: string[];
} {
  return { stderr: [], stdout: [] };
}

describe('runLbStatusCommand', () => {
  it('prints a status table for a single-provider config', () => {
    const io = captureIo();
    const code = runLbStatusCommand(['--provider', 'openai', '--model', 'gpt-4o'], {
      stderr: (msg: string) => io.stderr.push(msg),
      stdout: (msg: string) => io.stdout.push(msg)
    });
    expect(code).toBe(0);
    const output = io.stdout.join('\n');
    expect(output).toContain('Strategy:');
    expect(output).toContain('Provider count:');
    expect(output).toContain('openai');
  });

  it('emits JSON when --json is passed', () => {
    const io = captureIo();
    const code = runLbStatusCommand(['--provider', 'anthropic', '--json'], {
      stderr: (msg: string) => io.stderr.push(msg),
      stdout: (msg: string) => io.stdout.push(msg)
    });
    expect(code).toBe(0);
    const output = io.stdout.join('\n');
    expect(output).toContain('"strategy"');
    expect(output).toContain('"routing"');
    expect(output).toContain('"usage"');
  });

  it('accepts a custom strategy', () => {
    const io = captureIo();
    const code = runLbStatusCommand(['--provider', 'openai', '--strategy', 'round-robin', '--json'], {
      stderr: (msg: string) => io.stderr.push(msg),
      stdout: (msg: string) => io.stdout.push(msg)
    });
    expect(code).toBe(0);
    expect(io.stdout.join('\n')).toContain('"strategy": "round-robin"');
  });

  it('ignores unknown strategy values silently', () => {
    const io = captureIo();
    const code = runLbStatusCommand(['--provider', 'openai', '--strategy', 'banana', '--json'], {
      stderr: (msg: string) => io.stderr.push(msg),
      stdout: (msg: string) => io.stdout.push(msg)
    });
    expect(code).toBe(0);
    expect(io.stdout.join('\n')).toContain('"strategy": "adaptive"');
  });

  it('still succeeds with a default provider when none is configured', () => {
    const io = captureIo();
    const code = runLbStatusCommand([], {
      stderr: (msg: string) => io.stderr.push(msg),
      stdout: (msg: string) => io.stdout.push(msg)
    });
    expect(code).toBe(0);
    expect(io.stdout.join('\n')).toContain('default');
  });
});
