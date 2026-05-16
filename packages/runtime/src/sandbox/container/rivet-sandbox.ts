/**
 * Rivet-based containerized sandbox provider.
 * Rivet integration is currently disabled due to security vulnerabilities in its dependencies.
 */
export interface ContainerSandbox {
  readonly mode: 'container';
  execute(input: any, files?: any[]): Promise<any>;
  destroy(): Promise<void>;
}

/**
 * Placeholder for the Rivet implementation.
 * Throws an error when usage is attempted.
 */
export function createRivetSandbox(): ContainerSandbox {
  return {
    mode: 'container',

    async execute() {
      throw new Error(
        'Rivet container sandbox is currently disabled due to security vulnerabilities in its transitive dependencies (CVE-2024-10086, etc.). Please use "virtual" mode instead.'
      );
    },

    async destroy(): Promise<void> {
      // No-op
    }
  };
}
