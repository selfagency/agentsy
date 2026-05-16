import type { ContainerSandbox } from '../container/rivet-sandbox.js';
import type { SandboxTriggerDecision } from './dynamic-trigger.js';
import type { VirtualSandbox } from './virtual-sandbox.js';
import { createVirtualSandbox } from './virtual-sandbox.js';

export type AnySandbox = VirtualSandbox | ContainerSandbox;

export interface SandboxRouter {
  route(decision: SandboxTriggerDecision, containerSandbox?: ContainerSandbox): AnySandbox;
}

export function createSandboxRouter(): SandboxRouter {
  const virtualSandbox = createVirtualSandbox();

  return {
    route(decision, containerSandbox) {
      if (decision.mode === 'none') {
        throw new Error('Sandbox execution explicitly disabled by policy');
      }
      if (decision.mode === 'container' && containerSandbox !== undefined) {
        return containerSandbox;
      }
      // Fall back to virtual for 'virtual' or missing container.
      return virtualSandbox;
    }
  };
}
