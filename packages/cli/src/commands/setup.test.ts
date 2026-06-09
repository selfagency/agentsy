import { describe, expect, it } from 'vitest';

import { runSetupCommand } from './setup.js';

describe('runSetupCommand', () => {
  it('prints setup guidance for all targets', async () => {
    const stdout: string[] = [];
    const code = await runSetupCommand([], { stdout: value => stdout.push(value) });
    expect(code).toBe(0);
    expect(stdout.join('\n')).toContain('memory');
    expect(stdout.join('\n')).toContain('vscode');
  });

  it('prints JSON when requested', async () => {
    const stdout: string[] = [];
    const code = await runSetupCommand(['memory', '--json'], { stdout: value => stdout.push(value) });
    expect(code).toBe(0);
    expect(JSON.parse(stdout[0] ?? '[]')[0].target).toBe('memory');
  });
});
