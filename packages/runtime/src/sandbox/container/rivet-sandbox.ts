/**
 * Rivet-based containerized sandbox provider.
 * Rivet integration is currently disabled due to security vulnerabilities in its dependencies.
 */
export interface ContainerSandbox {
  readonly mode: "container";
  execute(input: unknown, files?: unknown[]): Promise<unknown>;
  destroy(): Promise<void>;
}

/**
 * Placeholder for the Rivet implementation.
 * Throws an error when usage is attempted.
 */
export function createRivetSandbox(): ContainerSandbox {
  return {
    async destroy(): Promise<void> {
      // No-op
    },

    async execute() {
      throw new Error(
        'Rivet container sandbox is currently disabled due to security vulnerabilities in its transitive dependencies (CVE-2024-10086, etc.). Please use "virtual" mode instead.'
      );
    },

    mode: "container",
  };
}
