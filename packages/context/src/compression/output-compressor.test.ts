import { describe, expect, it } from 'vitest';

import { compressOutput, compressOutputDetailed, createOutputCompressionMetadata } from './output-compressor.js';
import { compressOutputV2 } from './output-compressor-v2.js';

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

  it('retains protected content markers through compression', () => {
    const input = 'See https://example.com and `pnpm test`';

    const output = compressOutput(input, { level: 'full' });

    expect(output).toContain('https://example.com');
    expect(output).toContain('`pnpm test`');
  });

  it('creates reversible markers for protected segments', () => {
    const metadata = createOutputCompressionMetadata('See https://example.com and `pnpm test`');

    expect(metadata.markers).toHaveLength(2);
    expect(metadata.markers.map(marker => marker.kind)).toContain('preserved-url');
  });

  it('returns a richer content-aware result in v2', () => {
    const result = compressOutputV2('diff --git a/a b/a\n@@ -1 +1 @@\n-old\n+new', { level: 'full' });

    expect(result.contentKind).toBe('diff');
    expect(result.route.strategy).toBe('anchored-iterative');
    expect(result.metadata.markers.length).toBeGreaterThanOrEqual(0);
    expect(result.compressedTokens).toBeGreaterThan(0);
  });

  it('returns the detailed compression shape for the base helper', () => {
    const result = compressOutputDetailed('See https://example.com and `pnpm test`', { level: 'full' });

    expect(result.compressed).toContain('https://example.com');
    expect(result.metadata.markers).toHaveLength(2);
  });
});
