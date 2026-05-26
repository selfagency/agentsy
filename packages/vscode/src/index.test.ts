import { describe, expectTypeOf, it } from 'vitest';

import {
  accumulateToolCallDeltas,
  cancellationTokenToAbortSignal,
  createChunkNormalizerStub,
  createMockApiKeyManager,
  createMockRendererHandle,
  createVSCodeAgentLoop,
  createVSCodeChatRenderer,
  toVSCodeToolCallPart
} from './index.js';

describe('@agentsy/vscode export surface', () => {
  it('exports renderer lifecycle helpers', () => {
    expectTypeOf(createVSCodeChatRenderer).toBeFunction();
    expectTypeOf(createVSCodeAgentLoop).toBeFunction();
    expectTypeOf(cancellationTokenToAbortSignal).toBeFunction();
    expectTypeOf(accumulateToolCallDeltas).toBeFunction();
    expectTypeOf(toVSCodeToolCallPart).toBeFunction();
  });

  it('exports usage mapping and quota helpers', () => {
    expectTypeOf(createMockApiKeyManager).toBeFunction();
    expectTypeOf(createMockRendererHandle).toBeFunction();
    expectTypeOf(createChunkNormalizerStub).toBeFunction();
  });
});
