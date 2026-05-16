import { describe, expect, it, expectTypeOf } from 'vitest';

import * as vscodePackage from './index.js';

describe('@agentsy/vscode export surface', () => {
  it('exports renderer lifecycle helpers', () => {
    expectTypeOf(vscodePackage.createVSCodeChatRenderer).toBeFunction();
    expectTypeOf(vscodePackage.createVSCodeAgentLoop).toBeFunction();
    expectTypeOf(vscodePackage.cancellationTokenToAbortSignal).toBeFunction();
    expectTypeOf(vscodePackage.ToolCallDeltaAccumulator).toBeFunction();
    expectTypeOf(vscodePackage.accumulateToolCallDeltas).toBeFunction();
    expectTypeOf(vscodePackage.toVSCodeToolCallPart).toBeFunction();
  });

  it('exports usage mapping and quota helpers', () => {
    expectTypeOf(vscodePackage.mapUsageToVSCode).toBeFunction();
    expectTypeOf(vscodePackage.createQuotaDataSourceAdapter).toBeFunction();
    expectTypeOf(vscodePackage.pickActiveQuotaWindow).toBeFunction();
    expectTypeOf(vscodePackage.formatStandardQuotaTooltip).toBeFunction();
  });

  it('exports mcp helper and testing utilities', () => {
    expectTypeOf(vscodePackage.createMcpServerDefinitionProvider).toBeFunction();
    expectTypeOf(vscodePackage.McpServerRegistry).toBeFunction();
    expectTypeOf(vscodePackage.createMockApiKeyManager).toBeFunction();
    expectTypeOf(vscodePackage.createMockRendererHandle).toBeFunction();
    expectTypeOf(vscodePackage.createChunkNormalizerStub).toBeFunction();
  });
});
