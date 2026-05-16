import type { AgentFsEntry } from '@agentsy/memory';
import common from '@rivet-dev/agent-os-common';
import { AgentOs } from '@rivet-dev/agent-os-core';
import type { SandboxInput, SandboxOutput } from '../virtual/virtual-sandbox.js';

/**
 * Rivet-based containerized sandbox provider.
 * Implements full session isolation using Rivet Agent OS.
 */
export interface ContainerSandbox {
  readonly mode: 'container';
  execute(input: SandboxInput, files?: AgentFsEntry[]): Promise<SandboxOutput>;
  destroy(): Promise<void>;
}

/**
 * Rivet implementation of the ContainerSandbox.
 * Bridges our Sandbox interface to the @rivet-dev/agent-os SDK.
 */
export function createRivetSandbox(): ContainerSandbox {
  let os: AgentOs | null = null;

  async function ensureOs() {
    if (os === null) {
      os = await AgentOs.create({
        software: [common]
      });
    }
    return os;
  }

  return {
    mode: 'container',

    async execute(input: SandboxInput, files: AgentFsEntry[] = []): Promise<SandboxOutput> {
      const start = Date.now();
      const vm = await ensureOs();

      try {
        // 1. Synchronize AgentFS files to Rivet session
        for (const file of files) {
          // AgentFS entries are currently all files with path and content
          if (file.path !== undefined && file.content !== undefined) {
            await vm.writeFile(file.path, file.content);
          }
        }

        // 2. Write the code to execute to a temporary file
        const tempFile = `/tmp/sandbox_${Date.now()}.ts`;
        await vm.writeFile(tempFile, input.code);

        // 3. Execute 'tsx'
        // We use exec for one-shot execution.
        // The Kernel.exec takes a single string command.
        const result = await vm.exec(`tsx ${tempFile}`, {
          // Add environment variables if provided in input (extending for future)
          env: (input as { env?: Record<string, string> }).env ?? {}
        });

        // 4. Cleanup temp file
        await vm.delete(tempFile).catch(() => {});

        const exitCode = result.exitCode ?? 0;

        return {
          status: exitCode === 0 ? 'ok' : 'error',
          stdout: result.stdout,
          stderr: result.stderr,
          durationMs: Date.now() - start,
          exitCode
        };
      } catch (error) {
        return {
          status: 'error',
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - start,
          exitCode: 1
        };
      }
    },

    async destroy(): Promise<void> {
      if (os !== null) {
        // AgentOs doesn't have a direct 'dispose' but we can null it
        // and let GC handle the kernel instance.
        os = null;
      }
    }
  };
}
