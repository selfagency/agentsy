import { describe, it, expectTypeOf } from 'vitest';

import * as vscodePackage from './index.js';

describe('@agentsy/vscode export surface', () => {
  it('exports renderer lifecycle helpers', () => {
    expectTypeOf(vscodePackage.createVSCodeChatRenderer).toBeFunction();
    expectTypeOf(vscodePackage.createVSCodeAgentLoop).toBeFunction();
    expectTypeOf(vscodePackage.cancellationTokenToAbortSignal).toBeFunction();
    expectTypeOf(vscodePackage.accumulateToolCallDeltas).toBeFunction();
    expectTypeOf(vscodePackage.toVSCodeToolCallPart).toBeFunction();
  });

  it('exports usage mapping and quota helpers', () => {
    expectTypeOf(vscodePackage.createMockApiKeyManager).toBeFunction();
    expectTypeOf(vscodePackage.createMockRendererHandle).toBeFunction();
    expectTypeOf(vscodePackage.createChunkNormalizerStub).toBeFunction();
  });
});
