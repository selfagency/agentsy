import type { SandboxTriggerDecision } from './dynamic-trigger.js';
import type { SandboxInput, SandboxOutput, VirtualSandbox } from './virtual-sandbox.js';
import { createVirtualSandbox } from './virtual-sandbox.js';

export interface ContainerSandboxStub {
  readonly mode: 'container';
  execute(input: SandboxInput): Promise<SandboxOutput>;
}

export type AnySandbox = VirtualSandbox | ContainerSandboxStub;

export interface SandboxRouter {
  route(decision: SandboxTriggerDecision, containerSandbox?: ContainerSandboxStub): AnySandbox;
}

export function createSandboxRouter(): SandboxRouter {
  const virtualSandbox = createVirtualSandbox();

  return {
    route(decision, containerSandbox) {
      if (decision.mode === 'container' && containerSandbox !== undefined) {
        return containerSandbox;
      }
      // Fall back to virtual for 'virtual', 'none', or missing container.
      return virtualSandbox;
    }
  };
}
