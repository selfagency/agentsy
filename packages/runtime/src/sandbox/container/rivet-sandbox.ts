/**
 * Rivet-based containerized sandbox provider.
 * Rivet integration is currently disabled due to security vulnerabilities in its dependencies.
 */
export interface ContainerSandbox {
  destroy(): Promise<void>;
  execute(input: unknown, files?: unknown[]): Promise<unknown>;
  readonly mode: 'container';
}

// Re-enable when Rivet is safe to use
// function createRivetSandbox(): ContainerSandbox {
//   throw new Error('Rivet container sandbox is currently disabled due to security vulnerabilities in its transitive dependencies (CVE-2024-10086, etc.). Please use "virtual" mode instead.');
// }
