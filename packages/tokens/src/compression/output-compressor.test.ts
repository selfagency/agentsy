import { describe, expect, it } from 'vitest';

import { compressOutput } from './output-compressor.js';

describe(compressOutput, () => {
  it('preserves code fences, inline code, and URLs while compressing prose', () => {
    const input = [
      'This is basically a simple response that actually contains fluff.',
      'Run `pnpm test` before opening a pull request.',
      'Visit https://example.com/docs for full reference.',
      '```ts\nconst value = 42;\nconsole.log(value);\n```'
    ].join('\n\n');

    const output = compressOutput(input, { level: 'full' });

    expect(output).toContain('```ts\nconst value = 42;\nconsole.log(value);\n```');
    expect(output).toContain('`pnpm test`');
    expect(output).toContain('https://example.com/docs');
    expect(output.length).toBeLessThan(input.length);
  });

  it('applies stronger compression at higher intensity levels', () => {
    const input =
      'You should basically ensure that the configuration is actually validated before deployment in order to avoid issues.';

    const lite = compressOutput(input, { level: 'lite' });
    const ultra = compressOutput(input, { level: 'ultra' });

    expect(ultra.length).toBeLessThan(lite.length);
  });

  it('supports disabling preservation categories', () => {
    const input = 'Use `agentsy` command and check https://example.com/docs';

    const output = compressOutput(input, {
      level: 'full',
      preserve: {
        inlineCode: false,
        urls: false
      }
    });

    expect(output).not.toContain('`agentsy`');
    expect(output).not.toContain('https://example.com/docs');
  });
});
