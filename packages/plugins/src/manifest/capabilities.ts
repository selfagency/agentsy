import type { AgentManifest } from './types.js';

export function listManifestCapabilities(manifest: AgentManifest): string[] {
  return [...(manifest.capabilities ?? [])];
}

export function manifestSupportsHostTarget(manifest: AgentManifest, target: string): boolean {
  return (manifest.hostTargets ?? []).includes(target);
}

export function manifestExposesDiagnostics(manifest: AgentManifest): boolean {
  return manifest.diagnostics?.supported === true;
}
