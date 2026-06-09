/**
 * Plugin sandbox using isolated-vm for secure code execution.
 *
 * @module @agentsy/plugins/sandbox
 */

interface IsolatedVmReference<T = unknown> {
  apply(thisArg: unknown, args: readonly unknown[], options?: Record<string, unknown>): Promise<T>;
}

interface IsolatedVmContext {
  global: {
    derefInto(): unknown;
    get(name: string): Promise<IsolatedVmReference>;
    set(name: string, value: unknown): Promise<void>;
  };
}

interface IsolatedVmScript {
  run(context: IsolatedVmContext, options?: Record<string, unknown>): Promise<void>;
}

interface IsolatedVmModule {
  Callback: new (fn: (...args: unknown[]) => unknown, options?: Record<string, unknown>) => unknown;
  Isolate: new (options: {
    memoryLimit: number;
  }) => {
    compileScript(code: string, options?: Record<string, unknown>): Promise<IsolatedVmScript>;
    createContext(): Promise<IsolatedVmContext>;
    dispose(): void;
  };
  TimeoutError: new (...args: unknown[]) => Error;
}

async function loadIsolatedVm(): Promise<IsolatedVmModule> {
  const moduleName = 'isolated-vm';
  const loaded = (await import(moduleName)) as { default?: IsolatedVmModule } & Partial<IsolatedVmModule>;
  return (loaded.default ?? loaded) as IsolatedVmModule;
}

/**
 * Plugin descriptor passed to the sandbox for execution.
 */
export interface Plugin {
  /** JavaScript source code to execute in the sandbox. */
  readonly code: string;
  /** Plugin configuration. */
  readonly config?: {
    /** Whether the plugin is considered trusted. */
    readonly trusted?: boolean;
  };
  /** Unique plugin identifier. */
  readonly id: string;
  /** Plugin version (semver). */
  readonly version: string;
}

/**
 * Configuration options for the plugin sandbox.
 */
export interface SandboxOptions {
  /** List of capability identifiers the plugin is allowed to use. */
  readonly allowedCapabilities?: readonly string[];
  /** Memory limit in megabytes (default: 64). */
  readonly memoryLimitMb?: number;
  /** Execution timeout in milliseconds (default: 5000). */
  readonly timeoutMs?: number;
}

/**
 * Result of a sandboxed plugin execution.
 */
export interface SandboxResult {
  /** Execution duration in milliseconds. */
  readonly durationMs: number;
  /** The value returned by the entrypoint function. */
  readonly result: unknown;
}

/**
 * Sandbox execution error with typed discriminator.
 * Thrown as an Error subclass so callers can use `instanceof`.
 */
export class SandboxError extends Error {
  readonly kind: 'timeout' | 'memory' | 'runtime' | 'capability';
  readonly cause: unknown;

  constructor(opts: { kind: SandboxError['kind']; message: string; cause: unknown }) {
    super(opts.message);
    this.name = 'SandboxError';
    this.kind = opts.kind;
    this.cause = opts.cause;
  }
}

const DEFAULT_MEMORY_LIMIT_MB = 64;
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Build the host API object based on plugin trust level and allowed capabilities.
 * Returns a mutable record so callers can assign entries conditionally.
 */
function buildHostAPI(
  ivm: IsolatedVmModule,
  plugin: Plugin,
  options: Required<SandboxOptions>
): Record<string, unknown> {
  const api: Record<string, unknown> = {};

  const capabilities = new Set(options.allowedCapabilities);

  // Logging is allowed for trusted plugins or when explicitly granted
  if (plugin.config?.trusted || capabilities.has('log')) {
    api.log = new ivm.Callback(
      (...args: unknown[]) => {
        const message =
          typeof args[0] === 'object' && args[0] !== null ? JSON.stringify(args[0]) : String(args[0] ?? '');
        console.log(`[plugin:${plugin.id}] ${message}`);
      },
      { sync: true }
    );
  }

  return api;
}

/**
 * Run a plugin's entrypoint function in an isolated v8 sandbox.
 */
export async function runPluginInSandbox(
  plugin: Plugin,
  entrypoint: string,
  args: readonly unknown[],
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const resolvedOptions: Required<SandboxOptions> = {
    memoryLimitMb: options.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    allowedCapabilities: options.allowedCapabilities ?? []
  };

  const ivm = await loadIsolatedVm();
  const isolate = new ivm.Isolate({
    memoryLimit: resolvedOptions.memoryLimitMb
  });

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    // Make the global object accessible as `globalThis` inside the sandbox
    await jail.set('global', jail.derefInto());

    // Expose host API with only allowed capabilities
    const hostAPI = buildHostAPI(ivm, plugin, resolvedOptions);
    for (const [key, value] of Object.entries(hostAPI)) {
      if (value !== undefined) {
        await jail.set(key, value);
      }
    }

    // Compile the plugin code as a script
    const script = await isolate.compileScript(plugin.code, { filename: `plugin://${plugin.id}/entry.js` });

    // Run the script to define the entrypoint
    await script.run(context, {
      timeout: resolvedOptions.timeoutMs,
      release: true
    });

    // Call the entrypoint function with provided args
    const start = Date.now();
    const entryFn = await jail.get(entrypoint);

    const result = await entryFn.apply(undefined, args, {
      timeout: resolvedOptions.timeoutMs,
      arguments: { copy: true },
      result: { copy: true, promise: true }
    });

    const durationMs = Date.now() - start;

    return { result, durationMs };
  } catch (error: unknown) {
    if (error instanceof ivm.TimeoutError) {
      throw new SandboxError({
        kind: 'timeout',
        message: `Plugin "${plugin.id}" timed out after ${resolvedOptions.timeoutMs}ms`,
        cause: error
      });
    }

    if (error instanceof Error && /memory/i.test(error.message) && resolvedOptions.memoryLimitMb > 0) {
      throw new SandboxError({
        kind: 'memory',
        message: `Plugin "${plugin.id}" exceeded memory limit of ${resolvedOptions.memoryLimitMb}MB`,
        cause: error
      });
    }

    throw new SandboxError({
      kind: 'runtime',
      message:
        error instanceof Error
          ? `Plugin "${plugin.id}" runtime error: ${error.message}`
          : `Plugin "${plugin.id}" encountered an unknown error`,
      cause: error
    });
  } finally {
    isolate.dispose();
  }
}
