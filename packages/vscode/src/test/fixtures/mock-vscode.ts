import type { Event, ExtensionContext, Memento, SecretStorage, SecretStorageChangeEvent } from 'vscode';

/**
 * Mock Event implementation for testing.
 */
function createMockEvent<T>(): Event<T> {
  return (_listener: (e: T) => void) => ({ dispose: () => {} });
}

/**
 * Mock SecretStorage for testing.
 */
export class MockSecretStorage implements SecretStorage {
  private readonly storage: Map<string, string> = new Map();

  async get(key: string): Promise<string | undefined> {
    return this.storage.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  onDidChange: Event<SecretStorageChangeEvent> = createMockEvent();

  // Clear for test cleanup
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock Memento for testing.
 */
export class MockMemento implements Memento {
  private readonly storage: Map<string, unknown> = new Map();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.storage.get(key) as T) ?? defaultValue;
  }

  update(key: string, value: unknown): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  clear(): void {
    this.storage.clear();
  }
}

/**
 * Mock ExtensionContext for testing.
 */
export function createMockExtensionContext(): ExtensionContext {
  const mockUri = {
    scheme: 'file',
    authority: '',
    path: '/mock/path',
    query: '',
    fragment: '',
    fsPath: '/mock/path',
    with: () =>
      ({
        scheme: 'file',
        authority: '',
        path: '/mock/path',
        query: '',
        fragment: '',
        fsPath: '/mock/path',
        with: () => ({}),
        toJSON: () => ({})
      }) as unknown,
    toJSON: () => ({})
  } as unknown;

  return {
    subscriptions: [],
    extensionPath: '/mock/path',
    extensionUri: mockUri,
    globalStoragePath: '/mock/global',
    globalStorageUri: mockUri,
    workspaceStoragePath: '/mock/workspace',
    workspaceStorageUri: mockUri,
    logPath: '/mock/log',
    logUri: mockUri,
    logsPath: '/mock/logs',
    secrets: new MockSecretStorage(),
    globalState: new MockMemento(),
    workspaceState: new MockMemento(),
    extensionMode: 0 as unknown,
    environmentVariableCollection: {} as unknown,
    asAbsolutePath: (relativePath: string) => `/mock/path/${relativePath}`,
    storageUri: mockUri,
    storagePath: '/mock/storage',
    extension: {
      id: 'mock-extension',
      extensionPath: '/mock/path',
      extensionUri: mockUri,
      packageJSON: {},
      isActive: true,
      exports: undefined,
      activate: async () => undefined
    } as unknown,
    languageModelAccessInformation: {
      models: [],
      onDidChange: createMockEvent()
    } as unknown
  } as unknown as ExtensionContext;
}
