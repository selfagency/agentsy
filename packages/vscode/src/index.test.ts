import { describe, expect, it } from 'vitest';

import * as vscodePackage from './index.js';

describe('@agentsy/vscode export surface', () => {
  it('exports renderer lifecycle helpers', () => {
    expect(typeof vscodePackage.createVSCodeChatRenderer).toBe('function');
    expect(typeof vscodePackage.createVSCodeAgentLoop).toBe('function');
    expect(typeof vscodePackage.cancellationTokenToAbortSignal).toBe('function');
    expect(typeof vscodePackage.ToolCallDeltaAccumulator).toBe('function');
    expect(typeof vscodePackage.accumulateToolCallDeltas).toBe('function');
    expect(typeof vscodePackage.toVSCodeToolCallPart).toBe('function');
  });

  it('exports usage mapping and quota helpers', () => {
    expect(typeof vscodePackage.mapUsageToVSCode).toBe('function');
    expect(typeof vscodePackage.createQuotaDataSourceAdapter).toBe('function');
    expect(typeof vscodePackage.pickActiveQuotaWindow).toBe('function');
    expect(typeof vscodePackage.formatStandardQuotaTooltip).toBe('function');
  });

  it('exports mcp helper and testing utilities', () => {
    expect(typeof vscodePackage.createMcpServerDefinitionProvider).toBe('function');
    expect(typeof vscodePackage.McpServerRegistry).toBe('function');
    expect(typeof vscodePackage.createMockApiKeyManager).toBe('function');
    expect(typeof vscodePackage.createMockRendererHandle).toBe('function');
    expect(typeof vscodePackage.createChunkNormalizerStub).toBe('function');
  });
});
