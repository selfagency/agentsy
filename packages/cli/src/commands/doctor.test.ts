import { describe, expect, it } from 'vitest';

import { runDoctorCommand } from './doctor.js';

describe('runDoctorCommand', () => {
  it('prints reports for all targets', async () => {
    const stdout: string[] = [];
    const code = await runDoctorCommand([], { stdout: value => stdout.push(value) });
    expect(code).toBe(0);
    expect(stdout.join('\n')).toContain('memory');
    expect(stdout.join('\n')).toContain('vscode');
    expect(stdout.join('\n')).toContain('config');
  });

  it('prints JSON when requested', async () => {
    const stdout: string[] = [];
    const code = await runDoctorCommand(['memory', '--json'], { stdout: value => stdout.push(value) });
    expect(code).toBe(0);
    expect(JSON.parse(stdout[0] ?? '[]')[0].target).toBe('memory');
  });
});
