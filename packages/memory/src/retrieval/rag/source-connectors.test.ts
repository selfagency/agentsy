import { describe, expect, it } from 'vitest';

import { createSourceConnectors } from './source-connectors.js';

describe('source connectors', () => {
  it('blocks web fetch for hosts outside allowlist', async () => {
    const connectors = createSourceConnectors({
      web: {
        enabled: true,
        allowHosts: ['docs.example.com']
      }
    });

    await expect(connectors.fetchWebSource('https://evil.example.net/attack')).rejects.toThrow('allowlist');
  });
});
