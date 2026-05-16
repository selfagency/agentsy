import { describe, expect, it } from 'vitest';

import * as agents from './agents/index.js';
import * as plugins from './index.js';

describe('@agentsy/plugins package entrypoints', () => {
  it('loads the root module and agents module without throwing', () => {
    expect(plugins).toBeDefined();
    expect(agents).toBeDefined();
  });

  it('currently exposes no concrete agent exports from scaffolded module', () => {
    expect(Object.keys(agents)).toStrictEqual([]);
  });
});
