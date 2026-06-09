import { describe, expect, it } from 'vitest';

import { runMemoryMcpDiagnostics } from './mcp-diagnostics.js';

describe('runMemoryMcpDiagnostics', () => {
  it('reports MCP diagnostics', () => {
    expect(runMemoryMcpDiagnostics().length).toBeGreaterThan(0);
  });
});
