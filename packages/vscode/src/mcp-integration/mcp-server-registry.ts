import type { McpServerRegistryConfig, McpServerDefinition } from '../types/errors.js';

/**
 * Manages registration and lifecycle of MCP (Model Context Protocol) servers.
 * Supports static and dynamic server providers.
 * Uses dynamic import to degrade gracefully when VS Code is unavailable.
 */
export class McpServerRegistry {
  private readonly servers = new Map<string, McpServerDefinition>();
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(private readonly config: McpServerRegistryConfig) {}

  /**
   * Register a single MCP server definition.
   * Returns false if already registered.
   */
  register(server: McpServerDefinition): boolean {
    if (this.servers.has(server.name)) return false;
    this.servers.set(server.name, server);
    return true;
  }

  /**
   * Unregister a server by name.
   */
  unregister(name: string): boolean {
    return this.servers.delete(name);
  }

  /**
   * Check if a server is registered.
   */
  has(name: string): boolean {
    return this.servers.has(name);
  }

  /**
   * Get a registered server definition by name.
   */
  get(name: string): McpServerDefinition | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all registered server definitions.
   */
  getAll(): McpServerDefinition[] {
    return Array.from(this.servers.values());
  }

  /**
   * Load and register servers from all configured providers.
   */
  async loadFromProviders(): Promise<void> {
    if (!this.config.providers) return;
    for (const provider of this.config.providers) {
      const definitions = await provider.provide();
      for (const def of definitions) {
        this.register(def);
      }
    }
  }

  /**
   * Activate registry — loads from providers and optionally registers with VS Code.
   * No-op if VS Code unavailable.
   */
  async activate(): Promise<void> {
    await this.loadFromProviders();

    if (this.config.autoRegister) {
      await this.registerWithVscode();
    }
  }

  /**
   * Write all registered servers into VS Code workspace settings.
   * No-op if VS Code is unavailable.
   */
  async registerWithVscode(): Promise<void> {
    try {
      const vscode = await import('vscode');
      const config = vscode.workspace.getConfiguration();

      const existing: Record<string, unknown> =
        (config.get<Record<string, unknown>>(this.config.namespace) as Record<string, unknown>) ?? {};

      const merged: Record<string, unknown> = { ...existing };

      for (const server of this.servers.values()) {
        if (!server.disabled) {
          merged[server.name] = {
            command: server.command,
            ...(server.args?.length ? { args: server.args } : {}),
            ...(server.alwaysAllow ? { alwaysAllow: true } : {}),
          };
        }
      }

      await config.update(this.config.namespace, merged, vscode.ConfigurationTarget.Workspace);
    } catch {
      // VS Code not available
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.servers.clear();
  }
}
